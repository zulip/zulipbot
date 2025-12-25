import type { EmitterWebhookEvent } from "@octokit/webhooks/types";

import type { Client } from "../client.ts";

import * as responses from "./responses/index.ts";

export const run = function (
  this: Client,
  payload: EmitterWebhookEvent<"push">["payload"],
) {
  const repo = payload.repository;
  const { branch, label, comment } = this.cfg.pulls.status.mergeConflicts;
  const mainPush = payload.ref === `refs/heads/${branch}`;

  if (!mainPush || (!label && !comment)) return;

  return setTimeout(
    () => {
      void responses.mergeConflict.run.call(this, repo);
    },
    this.cfg.eventsDelay * 60 * 1000,
  );
};
