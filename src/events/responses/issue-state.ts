import type { components } from "@octokit/openapi-webhooks-types";
import { assertDefined, assertPresent } from "ts-extras";

import type { Client } from "../../client.ts";

const recentlyClosed = new Map();

export const close = function (
  this: Client,
  issue: components["schemas"]["webhook-issues-closed"]["issue"],
  repo: components["schemas"]["repository-webhooks"],
) {
  recentlyClosed.set(issue.id, issue);

  setTimeout(
    () => {
      void clearClosed.call(this, issue, repo);
    },
    this.cfg.eventsDelay * 60 * 1000,
  );
};

export const reopen = function (
  this: Client,
  issue: components["schemas"]["webhook-issues-reopened"]["issue"],
) {
  if (recentlyClosed.has(issue.id)) recentlyClosed.delete(issue.id);
};

async function clearClosed(
  this: Client,
  issue: components["schemas"]["webhook-issues-closed"]["issue"],
  repo: components["schemas"]["repository-webhooks"],
) {
  const repoOwner = repo.owner.login;
  const repoName = repo.name;

  const assignees = issue.assignees
    .filter((a) => a !== null)
    .map((a) => a.login);

  if (!recentlyClosed.has(issue.id) || assignees.length === 0) {
    return;
  }

  await this.issues.removeAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: issue.number,
    assignees: assignees,
  });

  recentlyClosed.delete(issue.id);
}

export const progress = function (
  this: Client,
  payload: components["schemas"][
    | "webhook-issues-assigned"
    | "webhook-issues-unassigned"],
) {
  assertPresent(payload.assignee);
  const action = payload.action;
  const number = payload.issue.number;
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const label = this.cfg.activity.issues.inProgress;
  assertDefined(label);
  assertDefined(payload.issue.labels);
  const labeled = payload.issue.labels.find((l) => l.name === label);

  const assignees = payload.issue.assignees;
  let assigned: number | boolean = assignees.length;
  // GitHub API bug sometimes doesn't remove unassigned user from array
  if (assigned === 1) assigned = payload.assignee.id !== assignees[0]!.id;

  if (action === "assigned" && !labeled) {
    void this.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: [label],
    });
  } else if (action === "unassigned" && !assigned && labeled) {
    void this.issues.removeLabel({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      name: label,
    });
  }
};
