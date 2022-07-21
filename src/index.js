import crypto from "crypto";
import fs from "fs";

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import fetch from "node-fetch";

import client from "./client.js";

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Website is running on http://localhost:${port}`);
});

app.get("/", (request, response) => {
  response.redirect("https://github.com/zulip/zulipbot");
});

const urlencodedParser = express.urlencoded({ extended: true });

const webhooks = new Webhooks({ secret: client.cfg.auth.webhookSecret });
webhooks.onAny(async ({ name, payload }) => {
  const repo = payload.repository ? payload.repository.full_name : null;
  const check = client.cfg.activity.check.repositories.includes(repo);
  const eventHandler = client.events.get(name);
  if (!check || !eventHandler) return;

  await eventHandler(payload);
});

app.use("/github", createNodeMiddleware(webhooks, { path: "/" }));

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
    const secretsPath = new URL("../config/secrets.json", import.meta.url);
    console.log(`Using value from \`${secretsPath}\` for \`${key}\`...`);
    const secrets = JSON.parse(fs.readFileSync(secretsPath));
    if (typeof secrets[key] !== "string") {
      throw new TypeError(`Expected string for \`${key}\``);
    }

    client.cfg.auth[key] = secrets[key];
  } catch {
    console.log(`\`${key}\` value was not set. Please fix your configuration.`);
    process.exit(1);
  }
}

const response = await client.users.getAuthenticated();
client.cfg.auth.username = response.data.login;
