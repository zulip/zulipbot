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
  if (req.get("X-GitHub-Event")) {
    const signature = req.get("X-Hub-Signature");
    const secret = client.cfg.auth.webhookSecret.toString();
    const body = JSON.stringify(req.body);
    const hmac = crypto.createHmac("sha1", secret).update(body).digest("hex");

    if (signature === `sha1=${hmac}`) {
      const validEvent = client.events.get(req.get("X-GitHub-Event"));
      if (validEvent) validEvent(req.body);
      return res.status(200).send("Valid request");
    }
  }
  res.status(500).send("Invalid request");
});

app.post("/travis", urlencodedParser, async(req, res) => {
  if (req.get("Travis-Repo-Slug")) {
    const r = await snekfetch.get("https://api.travis-ci.org/config");
    const pubKey = JSON.parse(r.text).config.notifications.webhook.public_key;
    const key = new NodeRSA(pubKey, {signingScheme: "sha1"});
    const signature = req.get("Signature");
    const payload = JSON.parse(req.body.payload);
    const valid = key.verify(payload, signature, "base64", "base64");

    if (valid) {
      client.events.get("travis")(payload);
      return res.status(200).send("Valid request");
    }
  }
  res.status(500).send("Invalid request");
});

process.on("unhandledRejection", (error, promise) => {
  console.error("An unhandled promise rejection was detected at:", promise);
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    client.automations.get("activity").run();
  }, client.cfg.activity.check.interval * 3600000);
}
