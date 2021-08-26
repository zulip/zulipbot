"use strict";

const recentlyClosed = new Map();

exports.close = function (issue, repo) {
  recentlyClosed.set(issue.id, issue);

  setTimeout(() => {
    clearClosed.call(this, issue, repo);
  }, this.cfg.eventsDelay * 60 * 1000);
};

exports.reopen = function (issue) {
  if (recentlyClosed.has(issue.id)) recentlyClosed.delete(issue.id);
};

async function clearClosed(issue, repo) {
  const repoOwner = repo.owner.login;
  const repoName = repo.name;

  if (!recentlyClosed.has(issue.id) || issue.assignees.length === 0) {
    return;
  }

  const assignees = JSON.stringify({
    assignees: issue.assignees.map((a) => a.login),
  });

  await this.issues.removeAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: issue.number,
    body: assignees,
  });

  recentlyClosed.delete(issue.id);
}

exports.progress = function (payload) {
  const action = payload.action;
  const number = payload.issue.number;
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const label = this.cfg.activity.issues.inProgress;
  const labeled = payload.issue.labels.find((l) => l.name === label);

  const assignees = payload.issue.assignees;
  let assigned = assignees.length;
  // GitHub API bug sometimes doesn't remove unassigned user from array
  if (assigned === 1) assigned = payload.assignee.id !== assignees[0].id;

  if (action === "assigned" && !labeled) {
    this.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: [label],
    });
  } else if (action === "unassigned" && !assigned && labeled) {
    this.issues.removeLabel({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      name: label,
    });
  }
};
