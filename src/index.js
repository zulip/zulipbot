const client = require("./client.js");
const crypto = require("crypto");
const express = require("express");
const NodeRSA = require("node-rsa");
const snekfetch = require("snekfetch");

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log("Website is running on http://localhost:" + port);
});

app.get("/", (req, res) => {
  res.redirect("https://github.com/zulip/zulipbot");
});

const jsonParser = express.json({limit: "50mb"});
const urlencodedParser = express.urlencoded({extended: true});

app.post("/github", jsonParser, async(req, res) => {
  const secret = client.cfg.auth.webhookSecret.toString();
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac("sha1", secret).update(body).digest("hex");
  const hash = Buffer.from(`sha1=${hmac}`);
  const signature = Buffer.from(req.get("X-Hub-Signature"));

  // compare buffer length first to prevent timingSafeEqual() errors
  const equalLength = hash.length !== signature.length;
  const equal = equalLength ? crypto.timingSafeEqual(hash, signature) : false;
  if (!equal) {
    return res.status(401).send("Signature doesn't match computed hash");
  }

  const eventType = req.get("X-GitHub-Event");
  if (!eventType) {
    return res.status(400).send("X-GitHub-Event header was null");
  }

  const repo = req.body.repository.full_name;
  const check = client.cfg.activity.check.repositories.includes(repo);
  const eventHandler = client.events.get(eventType);
  if (!check || !eventHandler) return res.status(204).end();

  eventHandler(req.body);
  res.status(202).send("Request is being processed");
});

async function generateTravisKey() {
  const r = await snekfetch.get("https://api.travis-ci.org/config");
  const pubKey = JSON.parse(r.text).config.notifications.webhook.public_key;
  const key = new NodeRSA(pubKey, {signingScheme: "sha1"});
  return key;
}

const travisKey = generateTravisKey();

app.post("/travis", urlencodedParser, async(req, res) => {
  const signature = req.get("Signature");
  const payload = JSON.parse(req.body.payload);
  const valid = travisKey.verify(payload, signature, "base64", "base64");

  if (!valid) {
    return res.status(401).send("Signature doesn't match computed hash");
  }

  client.events.get("travis")(payload);
  res.status(202).send("Request is being processed");
});

process.on("unhandledRejection", error => {
  console.log(`Unhandled promise rejection:\n${error.stack}`);
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    client.automations.get("activity").run();
  }, client.cfg.activity.check.interval * 3600000);
}
