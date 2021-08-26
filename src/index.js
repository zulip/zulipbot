"use strict";

const crypto = require("crypto");

const express = require("express");
const fetch = require("node-fetch");

const client = require("./client.js");

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Website is running on http://localhost:${port}`);
});

app.get("/", (request, response) => {
  response.redirect("https://github.com/zulip/zulipbot");
});

const jsonParser = express.json({ limit: "50mb" });
const urlencodedParser = express.urlencoded({ extended: true });

app.post("/github", jsonParser, async (request, response) => {
  const secret = client.cfg.auth.webhookSecret.toString();
  const body = JSON.stringify(request.body);
  const hmac = crypto.createHmac("sha1", secret).update(body).digest("hex");
  const hash = Buffer.from(`sha1=${hmac}`);
  const signature = Buffer.from(request.get("X-Hub-Signature"));

  // compare buffer length first to prevent timingSafeEqual() errors
  const equalLength = hash.length === signature.length;
  const equal = equalLength ? crypto.timingSafeEqual(hash, signature) : false;
  if (!equal) {
    return response.status(401).send("Signature doesn't match computed hash");
  }

  const eventType = request.get("X-GitHub-Event");
  if (!eventType) {
    return response.status(400).send("X-GitHub-Event header was null");
  }

  const payload = request.body;
  const repo = payload.repository ? payload.repository.full_name : null;
  const check = client.cfg.activity.check.repositories.includes(repo);
  const eventHandler = client.events.get(eventType);
  if (!check || !eventHandler) return response.status(204).end();

  eventHandler(payload);
  response.status(202).send("Request is being processed");
});

app.post("/travis", urlencodedParser, async (request, response) => {
  const travisResponse = await fetch("https://api.travis-ci.org/config");
  const json = await travisResponse.json();
  const publicKey = json.config.notifications.webhook.public_key;
  const verifier = crypto.createVerify("sha1");
  const signature = Buffer.from(request.headers.signature, "base64");
  verifier.update(request.body.payload);
  const valid = verifier.verify(publicKey, signature);

  if (!valid) {
    return response.status(401).send("Signature doesn't match computed hash");
  }

  const repo = request.get("Travis-Repo-Slug");
  if (!repo) {
    return response.status(400).send("Travis-Repo-Slug header was null");
  }

  const check = client.cfg.activity.check.repositories.includes(repo);
  if (!check) return response.status(204).end();

  const payload = JSON.parse(request.body.payload);
  client.events.get("travis")(payload);
  response.status(202).send("Request is being processed");
});

process.on("unhandledRejection", (error) => {
  console.log(`Unhandled promise rejection:\n${error.stack}`);
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    client.events.get("activity")();
  }, client.cfg.activity.check.interval * 3600000);
}

for (const pair of Object.entries(client.cfg.auth)) {
  const [key, value] = pair;

  if (typeof value === "string") {
    console.log(`Using environment variable value for \`${key}\`...`);
    continue;
  }

  try {
    const secretsPath = `${__dirname}/../config/secrets.json`;
    console.log(`Using value from \`${secretsPath}\` for \`${key}\`...`);
    const secrets = require(secretsPath);
    if (typeof secrets[key] !== "string") {
      throw new TypeError(`Expected string for \`${key}\``);
    }

    client.cfg.auth[key] = secrets[key];
  } catch {
    console.log(`\`${key}\` value was not set. Please fix your configuration.`);
    process.exit(1);
  }
}

client.users.getAuthenticated().then((response) => {
  client.cfg.auth.username = response.data.login;
});
