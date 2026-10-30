import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import _ from "lodash";
import { assertDefined, assertPresent } from "ts-extras";
import type { Bot } from "../bot.ts";
import type { CommandPayload } from "../commands/index.ts";
import * as responses from "./responses/index.ts";

export const run = async function (
  bot: Bot,
  payload: EmitterWebhookEvent<"issues" | "issue_comment">["payload"],
) {
  const action = payload.action;
  const repo = payload.repository;

  if (
    "assignee" in payload &&
    payload.assignee &&
    bot.cfg.activity.issues.inProgress !== undefined
  ) {
    await responses.issueState.progress(bot, payload);
  }

  if (action === "labeled" || action === "unlabeled") {
    assertDefined(payload.label);
    await responses.areaLabel.run(bot, payload.issue, repo, payload.label);
  } else if (action === "closed" && bot.cfg.activity.issues.clearClosed) {
    responses.issueState.close(bot, payload.issue, repo);
  } else if (action === "reopened") {
    responses.issueState.reopen(bot, payload.issue);
  } else if (action === "opened" || action === "created") {
    await parse(bot, payload);
  }
};

async function parse(bot: Bot, payload: CommandPayload) {
  const data = "comment" in payload ? payload.comment : payload.issue;
  assertPresent(data.user);
  const commenter = data.user.login;
  const body = data.body;
  const username = bot.cfg.auth.username;

  if (commenter === username || body === null) return;

  const prefix = new RegExp(
    String.raw`@${_.escapeRegExp(username)} +(\w+)((?: +(?:--\w+|"[^"]+"))*)`,
    "gv",
  );
  for (const [command, keyword, args] of body.matchAll(prefix)) {
    const codeBlocks = [`\`\`\`\r\n${command}\r\n\`\`\``, `\`${command}\``];
    if (codeBlocks.some((block) => body.includes(block))) continue;
    assertDefined(keyword);
    assertDefined(args);
    const file = bot.commands.get(keyword);

    if (file) {
      await file.run(bot, payload, commenter, args.trimStart());
    }
  }
}
