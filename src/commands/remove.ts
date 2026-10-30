import type { RestEndpointMethodTypes } from "@octokit/rest";
import { assertDefined } from "ts-extras";
import type { Bot } from "../bot.ts";
import type { CommandAliases, CommandPayload } from "./index.ts";

export const run = async function (
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
  args: string,
): Promise<
  | RestEndpointMethodTypes["issues"]["createComment"]["response"]
  | RestEndpointMethodTypes["issues"]["setLabels"]["response"]
  | undefined
  | true
> {
  const creator = payload.issue.user?.login;
  const self = bot.cfg.issues.commands.label.self;
  const isSelfLabel =
    typeof self === "object" ? !self.users.includes(commenter) : self;
  const isForbidden = isSelfLabel && creator !== commenter;
  const rawLabels = args.match(/".*?"/gv);
  if (isForbidden || rawLabels === null) return;

  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  assertDefined(payload.issue.labels);
  const issueLabels = [...payload.issue.labels].map((label) => label.name);

  const labels = rawLabels.map((string) => string.replaceAll('"', ""));
  const remainingLabels = issueLabels.filter(
    (label) => !labels.includes(label),
  );
  const rejected = labels.filter((label) => !issueLabels.includes(label));

  await bot.octokit.issues.setLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    labels: remainingLabels,
  });

  if (rejected.length === 0) return true;

  const isOne = rejected.length === 1;
  const type = payload.issue.pull_request ? "pull request" : "issue";

  const template = bot.templates.get("labelError");
  assertDefined(template);
  const error = template.format({
    labels: `Label${isOne ? "" : "s"}`,
    type,
    labelList: `"${rejected.join('", "')}"`,
    exist: `do${isOne ? "es" : ""} not exist`,
    beState: `w${isOne ? "as" : "ere"}`,
    action: "removed from",
  });

  return bot.octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: error,
  });
};

export const aliasPath = (commands: CommandAliases) => commands.label.remove;
