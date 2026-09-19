import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertPresent } from "ts-extras";
import type { Client } from "../client.ts";

export const run = async function (
  this: Client,
  payload: EmitterWebhookEvent<"member">["payload"],
): Promise<
  | RestEndpointMethodTypes["issues"]["createComment"]["response"]
  | true
  | undefined
> {
  const isClaimEnabled = this.cfg.issues.commands.assign.claim.length > 0;

  if (!isClaimEnabled || payload.action !== "added") return;

  assertPresent(payload.member);
  const member = payload.member.login;
  const repoFullName = payload.repository.full_name;
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;

  const invite = this.invites.get(`${member}@${repoFullName}`);

  if (invite === undefined) return;

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
