import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import _ from "lodash";
import { assertDefined, assertPresent } from "ts-extras";

import type { Client } from "../client.ts";
import type { CommandPayload } from "../commands/index.ts";

import * as responses from "./responses/index.ts";

export const run = async function (
  this: Client,
  payload: EmitterWebhookEvent<"issues" | "issue_comment">["payload"],
) {
  const action = payload.action;
  const repo = payload.repository;

  if (
    "assignee" in payload &&
    payload.assignee &&
    this.cfg.activity.issues.inProgress
  ) {
    responses.issueState.progress.call(this, payload);
  }

  if (action === "labeled" || action === "unlabeled") {
    assertDefined(payload.label);
    await responses.areaLabel.run.call(
      this,
      payload.issue,
      repo,
      payload.label,
    );
  } else if (action === "closed" && this.cfg.activity.issues.clearClosed) {
    responses.issueState.close.call(this, payload.issue, repo);
  } else if (action === "reopened") {
    responses.issueState.reopen.call(this, payload.issue);
  } else if (action === "opened" || action === "created") {
    parse.call(this, payload);
  }
};

function parse(this: Client, payload: CommandPayload) {
  const data = "comment" in payload ? payload.comment : payload.issue;
  assertPresent(data.user);
  const commenter = data.user.login;
  const body = data.body;
  const username = this.cfg.auth.username;

  if (commenter === username || !body) return;

  const prefix = new RegExp(
    String.raw`@${_.escapeRegExp(username)} +(\w+)( +(--\w+|"[^"]+"))*`,
    "g",
  );
  const parsed = body.match(prefix);
  if (!parsed) return;

  for (const command of parsed) {
    const codeBlocks = [`\`\`\`\r\n${command}\r\n\`\`\``, `\`${command}\``];
    if (codeBlocks.some((block) => body.includes(block))) continue;
    const [, keyword] = command.replace(/\s+/, " ").split(" ");
    assertDefined(keyword);
    const args = command.replace(/\s+/, " ").split(" ").slice(2).join(" ");
    const file = this.commands.get(keyword);

    if (file) {
      void file.run.call(this, payload, commenter, args);
    }
  }
}
