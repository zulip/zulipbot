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
  RestEndpointMethodTypes["issues"]["addLabels"]["response"] | undefined
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
  const issueLabels = new Set(payload.issue.labels.map((label) => label.name));

  const repoLabelArray = await bot.octokit.paginate(
    bot.octokit.issues.listLabelsForRepo,
    {
      owner: repoOwner,
      repo: repoName,
    },
  );

  const repoLabels = new Set(repoLabelArray.map((label) => label.name));
  const labels = rawLabels.map((string) => string.replaceAll('"', ""));

  const alreadyAdded = labels.filter((label) => issueLabels.has(label));
  const rejected = labels.filter((label) => !repoLabels.has(label));
  const newLabels = labels.filter(
    (label) => repoLabels.has(label) && !issueLabels.has(label),
  );

  const type = payload.issue.pull_request ? "pull request" : "issue";
  const template = bot.templates.get("labelError");
  assertDefined(template);
  let response;

  if (rejected.length > 0) {
    const isOne = rejected.length === 1;
    const error = template.format({
      labels: `Label${isOne ? "" : "s"}`,
      type,
      labelList: `"${rejected.join('", "')}"`,
      exist: `do${isOne ? "es" : ""} not exist`,
      beState: `w${isOne ? "as" : "ere"}`,
      action: "added to",
    });

    await bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (alreadyAdded.length > 0) {
    const isOne = alreadyAdded.length === 1;
    const error = template.format({
      labels: `Label${isOne ? "" : "s"}`,
      labelList: `"${alreadyAdded.join('", "')}"`,
      exist: `already exist${isOne ? "s" : ""}`,
      beState: `w${isOne ? "as" : "ere"}`,
      action: "added to",
      type,
    });

    await bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (newLabels.length > 0) {
    response = await bot.octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: newLabels,
    });
  }

  return response;
};

export const aliasPath = (commands: CommandAliases) => commands.label.add;
