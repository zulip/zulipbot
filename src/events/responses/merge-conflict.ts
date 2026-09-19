import type { components } from "@octokit/openapi-webhooks-types";
import { assertDefined, assertPresent } from "ts-extras";
import type { Client } from "../../client.ts";

let isSweepInProgress = false;
let wasSweepRequested = false;

export const run = async function (
  this: Client,
  repo:
    | components["schemas"]["repository"]
    | components["schemas"]["webhook-push"]["repository"],
) {
  if (isSweepInProgress) {
    wasSweepRequested = true;
    return;
  }

  isSweepInProgress = true;
  try {
    do {
      wasSweepRequested = false;
      const repoName = repo.name;
      assertPresent(repo.owner);
      const repoOwner = repo.owner.login;

      for await (const response of this.paginate.iterator(this.pulls.list, {
        owner: repoOwner,
        repo: repoName,
      })) {
        for (const pull of response.data) {
          await check.call(this, pull.number, repo);
        }
      }
    } while (wasSweepRequested);
  } finally {
    isSweepInProgress = false;
  }
};

async function check(
  this: Client,
  number: number,
  repo:
    | components["schemas"]["repository"]
    | components["schemas"]["webhook-push"]["repository"],
) {
  const repoName = repo.name;
  assertPresent(repo.owner);
  const repoOwner = repo.owner.login;
  const { branch, label, comment } = this.cfg.pulls.status.mergeConflicts;

  const pull = await this.pulls.get({
    owner: repoOwner,
    repo: repoName,
    pull_number: number,
  });

  // Use a strict false check; unknown merge conflict statuses return null
  if (pull.data.mergeable !== false) return;

  const username = pull.data.user.login;

  const template = this.templates.get("mergeConflictWarning");
  assertDefined(template);
  const warning = template.format({
    username,
    branch,
    repoOwner,
    repoName,
  });

  const warnings = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  let lastCommitTime: string | undefined;
  for await (const response of this.paginate.iterator(this.pulls.listCommits, {
    owner: repoOwner,
    repo: repoName,
    pull_number: number,
  })) {
    const last = response.data.at(-1);
    if (last) lastCommitTime = last.commit.committer?.date ?? lastCommitTime;
  }

  const hasWarnComment = warnings.some(
    (c) =>
      lastCommitTime === undefined ||
      Date.parse(lastCommitTime) < Date.parse(c.created_at),
  );

  const labels = await this.issues.listLabelsOnIssue({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });
  const isInactive = labels.data.some(
    (l) => l.name === this.cfg.activity.inactive,
  );

  if (isInactive) return;

  if (!hasWarnComment && comment) {
    await this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: warning,
    });
  }

  if (label !== null) {
    await this.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: [label],
    });
  }
}
