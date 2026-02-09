import fs from "fs";

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { assertDefined, safeCastTo } from "ts-extras";

import client from "./client.ts";
import * as events from "./events/index.ts";
import { logRateLimit } from "./utils/rate-limit-monitor.ts";

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

  try {
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
  } catch (error) {
    console.error(
      `Error processing ${event.name} event:`,
      error instanceof Error ? error.stack : String(error)
    );
    // Event processing failed but don't crash - log for monitoring
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
    void events.activity.run.call(client).catch((error) => {
      console.error(
        "Error during activity check:",
        error instanceof Error ? error.stack : String(error)
      );
    });
  }, client.cfg.activity.check.interval * 3600000);
}

// Periodic cache cleanup every 10 minutes to free memory
setInterval(() => {
  client.clearExpiredCache();
}, 10 * 60 * 1000);

// Log cache statistics every hour if caching is enabled
if (client.cfg.rateLimit.caching.enabled) {
  setInterval(() => {
    const stats = client.getCacheStats();
    if (stats.hits + stats.misses > 0) {
      client.log.info(
        `Cache stats: ${stats.hitRate}% hit rate (${stats.hits} hits, ${stats.misses} misses, ${stats.size} entries)`
      );
    }
  }, 60 * 60 * 1000); // Every hour
}

// Monitor rate limit status periodically if enabled
if (client.cfg.rateLimit.monitoring.enabled) {
  setInterval(() => {
    // Force refresh on periodic checks to get accurate data
    void logRateLimit(client, true).catch((error) => {
      console.error(
        "Error checking rate limit:",
        error instanceof Error ? error.message : String(error)
      );
    });
  }, client.cfg.rateLimit.monitoring.logInterval);

  // Log initial rate limit status on startup (force refresh)
  void logRateLimit(client, true).catch((error) => {
    console.error(
      "Error checking initial rate limit:",
      error instanceof Error ? error.message : String(error)
    );
  });
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
