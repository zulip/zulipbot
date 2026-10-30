import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertDefined } from "ts-extras";
import type { Bot } from "../bot.ts";
import * as responses from "./responses/index.ts";

export const run = async function (
  bot: Bot,
  payload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"],
) {
  const action = payload.action;
  const repo = payload.repository;
  const assignee = bot.cfg.activity.pulls.reviewed.assignee;
  const shouldCheckReferences = bot.cfg.pulls.references.required;
  const shouldAutoUpdate = bot.cfg.activity.pulls.autoUpdate;
  const size = bot.cfg.pulls.status.size;

  if (shouldAutoUpdate || size.labels) {
    await responses.pullState.addLabels(bot, payload);
  }

  if (action === "submitted" && assignee) {
    await responses.pullState.assign(bot, payload);
  } else if (action === "labeled" || action === "unlabeled") {
    const l = payload.label;
    assertDefined(l);
    const issue = await bot.octokit.issues.get({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: payload.pull_request.number,
    });
    await responses.areaLabel.run(bot, issue.data, repo, l);
  }

  if (
    !shouldCheckReferences ||
    (bot.cfg.pulls.status.wip !== null &&
      payload.pull_request.title.includes(bot.cfg.pulls.status.wip))
  ) {
    return;
  }

  if (action === "opened") {
    await responses.reference.run(bot, payload.pull_request, repo, true);
  } else if (action === "synchronize") {
    await responses.reference.run(bot, payload.pull_request, repo, false);
    await responses.pullState.update(bot, payload.pull_request, repo);
  }
};
