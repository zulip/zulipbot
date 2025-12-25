import _ from "lodash";

import * as responses from "./responses/index.js";

export const run = async function (payload) {
  const action = payload.action;
  const issue = payload.issue;
  const repo = payload.repository;
  const label = payload.label;

  if (payload.assignee && this.cfg.activity.issues.inProgress) {
    responses.issueState.progress.call(this, payload);
  }

  if (["labeled", "unlabeled"].includes(action)) {
    await responses.areaLabel.run.call(this, issue, repo, label);
  } else if (action === "closed" && this.cfg.activity.issues.clearClosed) {
    responses.issueState.close.call(this, issue, repo);
  } else if (action === "reopened") {
    responses.issueState.reopen.call(this, issue);
  } else if (action === "opened" || action === "created") {
    parse.call(this, payload);
  }
};

function parse(payload) {
  const data = payload.comment || payload.issue;
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
    const args = command.replace(/\s+/, " ").split(" ").slice(2).join(" ");
    const file = this.commands.get(keyword);

    if (file) {
      file.run.call(this, payload, commenter, args);
    }
  }
}

export const events = ["issues", "issue_comment"];
