import { assertDefined } from "ts-extras";

import type { Client } from "../client.ts";

import type { CommandAliases, CommandPayload } from "./index.ts";

export const run = async function (
  this: Client,
  payload: CommandPayload,
  commenter: string,
  args: string,
) {
  const creator = payload.issue.user?.login;
  const self = this.cfg.issues.commands.label.self;
  const selfLabel =
    typeof self === "object" ? !self.users.includes(commenter) : self;
  const forbidden = selfLabel && creator !== commenter;
  const rawLabels = args.match(/".*?"/g);
  if (forbidden || rawLabels === null) return;

  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  assertDefined(payload.issue.labels);
  const issueLabels = [...payload.issue.labels].map((label) => label.name);

  const labels = rawLabels.map((string) => string.replaceAll('"', ""));
  const removeLabels = issueLabels.filter((label) => !labels.includes(label));
  const rejected = labels.filter((label) => !issueLabels.includes(label));

  await this.issues.setLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    labels: removeLabels,
  });

  if (rejected.length === 0) return true;

  const one = rejected.length === 1;
  const type = payload.issue.pull_request ? "pull request" : "issue";

  const template = this.templates.get("labelError");
  assertDefined(template);
  const error = template.format({
    labels: `Label${one ? "" : "s"}`,
    type: type,
    labelList: `"${rejected.join('", "')}"`,
    exist: `do${one ? "es" : ""} not exist`,
    beState: `w${one ? "as" : "ere"}`,
    action: "removed from",
  });

  return this.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: error,
  });
};

export const aliasPath = (commands: CommandAliases) => commands.label.remove;
