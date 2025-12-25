import fs from "fs";

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";

import client from "./client.js";
import * as events from "./events/index.js";

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Website is running on http://localhost:${port}`);
});

app.get("/", (request, response) => {
  response.redirect("https://github.com/zulip/zulipbot");
});

const webhooks = new Webhooks({ secret: client.cfg.auth.webhookSecret });
webhooks.onAny(async (event) => {
  const repo = event.payload.repository
    ? event.payload.repository.full_name
    : null;
  if (!client.cfg.activity.check.repositories.includes(repo)) return;

  switch (event.name) {
    case "issues":
    case "issue_comment": {
      await events.issue.run.call(client, event.payload);
      break;
    }

    case "member": {
      await events.member.run.call(client, event.payload);
      break;
    }

    case "pull_request":
    case "pull_request_review": {
      await events.pull.run.call(client, event.payload);
      break;
    }

    case "push": {
      await events.push.run.call(client, event.payload);
      break;
    }

    // no default
  }
});

app.use("/github", createNodeMiddleware(webhooks, { path: "/" }));

process.on("unhandledRejection", (error) => {
  console.log(`Unhandled promise rejection:\n${error.stack}`);
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    events.activity.run.call(client);
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
