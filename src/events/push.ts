import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import type { Bot } from "../bot.ts";
import * as responses from "./responses/index.ts";

export const run = function (
  bot: Bot,
  payload: EmitterWebhookEvent<"push">["payload"],
) {
  const repo = payload.repository;
  const { branch, label, comment } = bot.cfg.pulls.status.mergeConflicts;
  const isMainPush = payload.ref === `refs/heads/${branch}`;

  if (!isMainPush || (label === null && !comment)) return;

  return setTimeout(
    () => {
      void responses.mergeConflict.run(bot, repo);
    },
    bot.cfg.eventsDelay * 60 * 1000,
  );
};
