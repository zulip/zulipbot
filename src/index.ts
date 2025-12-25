import fs from "fs";

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { assertDefined, safeCastTo } from "ts-extras";

import client from "./client.ts";
import * as events from "./events/index.ts";

const app = express();
const port = process.env["PORT"] ?? 8080;

app.listen(port, () => {
  console.log(`Website is running on http://localhost:${port}`);
});

app.get("/", (_request, response) => {
  response.redirect("https://github.com/zulip/zulipbot");
});

assertDefined(client.cfg.auth.webhookSecret);
const webhooks = new Webhooks({ secret: client.cfg.auth.webhookSecret });
webhooks.onAny(async (event) => {
  if (
    !("repository" in event.payload) ||
    event.payload.repository === null ||
    !client.cfg.activity.check.repositories.includes(
      event.payload.repository.full_name,
    )
  ) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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
      events.push.run.call(client, event.payload);
      break;
    }

    // no default
  }
});

app.use("/github", createNodeMiddleware(webhooks, { path: "/" }));

process.on("unhandledRejection", (error) => {
  console.log(
    `Unhandled promise rejection:\n${error instanceof Error ? error.stack : String(error)}`,
  );
});

if (client.cfg.activity.check.interval) {
  setInterval(() => {
    void events.activity.run.call(client);
  }, client.cfg.activity.check.interval * 3600000);
}

for (const key of ["oAuthToken", "webhookSecret"] as const) {
  const value = client.cfg.auth[key];

  if (typeof value === "string") {
    console.log(`Using environment variable value for \`${key}\`...`);
    continue;
  }

  try {
    const secretsPath = new URL("../config/secrets.json", import.meta.url);
    console.log(`Using value from \`${secretsPath.href}\` for \`${key}\`...`);
    const secrets: unknown = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    let secret;
    if (
      typeof secrets !== "object" ||
      secrets === null ||
      typeof (secret = safeCastTo<{
        oAuthToken?: string;
        webhookSecret?: string;
      }>(secrets)[key]) !== "string"
    ) {
      throw new TypeError(`Expected string for \`${key}\``);
    }

    client.cfg.auth[key] = secret;
  } catch {
    console.log(`\`${key}\` value was not set. Please fix your configuration.`);
    process.exit(1);
  }
}

const response = await client.users.getAuthenticated();
client.cfg.auth.username = response.data.login;
