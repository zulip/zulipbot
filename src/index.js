const client = require("./client.js");
const crypto = require("crypto");
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Website is running on http://localhost:${port}`);
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
  const equalLength = hash.length === signature.length;
  const equal = equalLength ? crypto.timingSafeEqual(hash, signature) : false;
  if (!equal) {
    return res.status(401).send("Signature doesn't match computed hash");
  }

  const eventType = req.get("X-GitHub-Event");
  if (!eventType) {
    return res.status(400).send("X-GitHub-Event header was null");
  }

  const payload = req.body;
  const repo = payload.repository ? payload.repository.full_name : null;
  const check = client.cfg.activity.check.repositories.includes(repo);
  const eventHandler = client.events.get(eventType);
  if (!check || !eventHandler) return res.status(204).end();

  eventHandler(payload);
  res.status(202).send("Request is being processed");
});

app.post("/travis", urlencodedParser, async(req, res) => {
  const response = await fetch("https://api.travis-ci.org/config");
  const json = await response.json();
  const publicKey = json.config.notifications.webhook.public_key;
  const verifier = crypto.createVerify("sha1");
  const signature = Buffer.from(req.headers.signature, "base64");
  verifier.update(req.body.payload);
  const valid = verifier.verify(publicKey, signature);

  if (!valid) {
    return res.status(401).send("Signature doesn't match computed hash");
  }

  const repo = req.get("Travis-Repo-Slug");
  if (!repo) {
    return res.status(400).send("Travis-Repo-Slug header was null");
  }

  const check = client.cfg.activity.check.repositories.includes(repo);
  if (!check) return res.status(204).end();

  const payload = JSON.parse(req.body.payload);
  client.events.get("travis")(payload);
  res.status(202).send("Request is being processed");
});

process.on("unhandledRejection", error => {
  console.log(`Unhandled promise rejection:\n${error.stack}`);
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    client.events.get("activity")();
  }, client.cfg.activity.check.interval * 3600000);
}

Object.entries(client.cfg.auth).forEach(pair => {
  const [key, value] = pair;

  if (typeof value === "string") {
    return console.log(`Using environment variable value for \`${key}\`...`);
  }

  try {
    const secretsPath = `${__dirname}/../config/secrets.json`;
    console.log(`Using value from \`${secretsPath}\` for \`${key}\`...`);
    const secrets = require(secretsPath);
    if (typeof secrets[key] !== "string") throw new Error();
    client.cfg.auth[key] = secrets[key];
  } catch (e) {
    console.log(`\`${key}\` value was not set. Please fix your configuration.`);
    process.exit(1);
  }
});

client.authenticate({
  type: "basic",
  username: client.cfg.auth.username,
  password: client.cfg.auth.password
});
