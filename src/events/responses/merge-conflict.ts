import type { components } from "@octokit/openapi-webhooks-types";
import { assertDefined, assertPresent } from "ts-extras";
import type { Client } from "../../client.ts";

let sweepInProgress = false;
let sweepRequested = false;

export const run = async function (
  this: Client,
  repo:
    | components["schemas"]["repository"]
    | components["schemas"]["webhook-push"]["repository"],
) {
  if (sweepInProgress) {
    sweepRequested = true;
    return;
  }

  sweepInProgress = true;
  try {
    do {
      sweepRequested = false;
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
    } while (sweepRequested);
  } finally {
    sweepInProgress = false;
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

  const mergeable = pull.data.mergeable;
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

  // Use a strict false check; unknown merge conflict statuses return null
  if (mergeable === false) {
    let lastCommitTime: string | undefined;
    for await (const response of this.paginate.iterator(
      this.pulls.listCommits,
      {
        owner: repoOwner,
        repo: repoName,
        pull_number: number,
      },
    )) {
      const last = response.data.at(-1);
      if (last) lastCommitTime = last.commit.committer?.date ?? lastCommitTime;
    }

    const warnComment = warnings.some(
      (c) =>
        lastCommitTime === undefined ||
        Date.parse(lastCommitTime) < Date.parse(c.created_at),
    );

    const labels = await this.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });
    const inactive = labels.data.some(
      (l) => l.name === this.cfg.activity.inactive,
    );

    if (inactive) return;

    if (!warnComment && comment) {
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
}
