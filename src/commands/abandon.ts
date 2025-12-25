import type { Client } from "../client.ts";

import type { CommandAliases, CommandPayload } from "./index.ts";

export const run = async function (
  this: Client,
  payload: CommandPayload,
  commenter: string,
) {
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const number = payload.issue.number;
  const assignees = payload.issue.assignees.map((assignee) => assignee?.login);

  if (!assignees.includes(commenter)) {
    const error = "**ERROR:** You have not claimed this issue to work on yet.";
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  return this.issues.removeAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [commenter],
  });
};

export const aliasPath = (commands: CommandAliases) => commands.assign.abandon;
