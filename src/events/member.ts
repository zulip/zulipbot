import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertDefined, assertPresent } from "ts-extras";

import type { Client } from "../client.ts";

export const run = async function (
  this: Client,
  payload: EmitterWebhookEvent<"member">["payload"],
) {
  const claimEnabled = this.cfg.issues.commands.assign.claim.length;

  if (payload.action !== "added" || !claimEnabled) return;

  assertPresent(payload.member);
  const member = payload.member.login;
  const repoFullName = payload.repository.full_name;
  const invite = this.invites.get(`${member}@${repoFullName}`);

  if (!invite) return;

  const [repoOwner, repoName] = repoFullName.split("/");
  assertDefined(repoOwner);
  assertDefined(repoName);

  const response = await this.issues.addAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: invite,
    assignees: [member],
  });

  this.invites.delete(`${member}@${repoFullName}`);

  if (
    response.data.assignees !== undefined &&
    response.data.assignees !== null &&
    response.data.assignees.length > 0
  ) {
    return true;
  }

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  return this.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: invite,
    body: error,
  });
};
