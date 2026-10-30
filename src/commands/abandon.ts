import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Bot } from "../bot.ts";
import type { CommandAliases, CommandPayload } from "./index.ts";

export const run = async function (
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
): Promise<
  | RestEndpointMethodTypes["issues"]["createComment"]["response"]
  | RestEndpointMethodTypes["issues"]["removeAssignees"]["response"]
> {
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const number = payload.issue.number;
  const assignees = payload.issue.assignees.map((assignee) => assignee?.login);

  if (!assignees.includes(commenter)) {
    const error = "**ERROR:** You have not claimed this issue to work on yet.";
    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  return bot.octokit.issues.removeAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [commenter],
  });
};

export const aliasPath = (commands: CommandAliases) => commands.assign.abandon;
