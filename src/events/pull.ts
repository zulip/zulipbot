import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertDefined } from "ts-extras";

import type { Client } from "../client.ts";

import * as responses from "./responses/index.ts";

export const run = async function (
  this: Client,
  payload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"],
) {
  const action = payload.action;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pulls.reviewed.assignee;
  const reference = this.cfg.pulls.references.required;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const size = this.cfg.pulls.status.size;

  if (autoUpdate || size) {
    await responses.pullState.label.call(this, payload);
  }

  if (action === "submitted" && assignee) {
    responses.pullState.assign.call(this, payload);
  } else if (action === "labeled" || action === "unlabeled") {
    const l = payload.label;
    assertDefined(l);
    const issue = await this.issues.get({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: payload.pull_request.number,
    });
    await responses.areaLabel.run.call(this, issue.data, repo, l);
  }

  if (
    !reference ||
    (this.cfg.pulls.status.wip !== null &&
      payload.pull_request.title.includes(this.cfg.pulls.status.wip))
  ) {
    return;
  }

  if (action === "opened") {
    await responses.reference.run.call(this, payload.pull_request, repo, true);
  } else if (action === "synchronize") {
    await responses.reference.run.call(this, payload.pull_request, repo, false);
    await responses.pullState.update.call(this, payload.pull_request, repo);
  }
};
