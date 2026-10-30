import type { components } from "@octokit/openapi-webhooks-types";
import { assertDefined, assertPresent } from "ts-extras";
import type { Bot } from "../../bot.ts";

const recentlyClosed = new Map();

export const close = function (
  bot: Bot,
  issue: components["schemas"]["webhook-issues-closed"]["issue"],
  repo: components["schemas"]["repository-webhooks"],
) {
  recentlyClosed.set(issue.id, issue);

  setTimeout(
    () => {
      void clearClosed(bot, issue, repo);
    },
    bot.cfg.eventsDelay * 60 * 1000,
  );
};

export const reopen = function (
  _bot: Bot,
  issue: components["schemas"]["webhook-issues-reopened"]["issue"],
) {
  if (recentlyClosed.has(issue.id)) recentlyClosed.delete(issue.id);
};

async function clearClosed(
  bot: Bot,
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

  await bot.octokit.issues.removeAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: issue.number,
    assignees,
  });

  recentlyClosed.delete(issue.id);
}

export const progress = async function (
  bot: Bot,
  payload: components["schemas"][
    "webhook-issues-assigned" | "webhook-issues-unassigned"],
) {
  assertPresent(payload.assignee);
  const action = payload.action;
  const number = payload.issue.number;
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const label = bot.cfg.activity.issues.inProgress;
  assertDefined(label);
  assertDefined(payload.issue.labels);
  const isLabeled = payload.issue.labels.some((l) => l.name === label);

  // GitHub API bug sometimes doesn't remove unassigned user from array
  const isAssigned = payload.issue.assignees.some(
    (assignee) => assignee !== null && assignee.id !== payload.assignee?.id,
  );

  if (action === "assigned" && !isLabeled) {
    await bot.octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: [label],
    });
  } else if (action === "unassigned" && !isAssigned && isLabeled) {
    await bot.octokit.issues.removeLabel({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      name: label,
    });
  }
};
