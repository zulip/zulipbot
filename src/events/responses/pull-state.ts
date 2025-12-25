import type { components } from "@octokit/openapi-types";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import _ from "lodash";
import { assertDefined, assertPresent } from "ts-extras";

import type { Client } from "../../client.ts";
import Search from "../../structures/reference-search.ts";

export const label = async function (
  this: Client,
  payload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"],
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.pull_request.number;
  const action = payload.action;

  const response = await this.issues.listLabelsOnIssue({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  let labels = response.data.map((label) => label.name);
  const oldLabels = labels;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const sizeLabels = this.cfg.pulls.status.size.labels;

  if (autoUpdate) {
    const author = payload.pull_request.user?.login;
    const reviewer = "review" in payload ? payload.review.user?.login : null;
    labels = review.call(this, labels, action, author, reviewer);
  }

  if (sizeLabels && ["opened", "synchronize"].includes(action)) {
    const repo = payload.repository;
    labels = await size.call(this, sizeLabels, labels, number, repo);
  }

  if (!_.isEqual(oldLabels.toSorted(), labels.toSorted())) {
    await this.issues.setLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: labels,
    });
  }
};

function review(
  this: Client,
  labels: string[],
  action: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"]["action"],
  author: string | undefined,
  reviewer: string | null | undefined,
) {
  const needsReviewLabel = this.cfg.activity.pulls.needsReview.label;
  assertPresent(needsReviewLabel);
  const reviewedLabel = this.cfg.activity.pulls.reviewed.label;
  assertPresent(reviewedLabel);
  const needsReview = labels.includes(needsReviewLabel);
  const reviewed = labels.includes(reviewedLabel);

  if (action === "opened" || action === "reopened") {
    labels.push(needsReviewLabel);
  } else if (action === "submitted" && needsReview && reviewer !== author) {
    labels[labels.indexOf(needsReviewLabel)] = reviewedLabel;
  } else if (action === "synchronize" && reviewed) {
    labels[labels.indexOf(reviewedLabel)] = needsReviewLabel;
  } else if (action === "closed" && reviewed) {
    labels.splice(labels.indexOf(reviewedLabel), 1);
  } else if (action === "closed" && needsReview) {
    labels.splice(labels.indexOf(needsReviewLabel), 1);
  }

  return labels;
}

async function size(
  this: Client,
  sizeLabels: Map<string, number>,
  labels: string[],
  number: number,
  repo: components["schemas"]["repository-webhooks"],
) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const pullLabels = labels.filter((label) => !sizeLabels.has(label));

  const files = await this.paginate(this.pulls.listFiles, {
    owner: repoOwner,
    repo: repoName,
    pull_number: number,
  });

  const changes = files
    .filter(
      (file) => !this.cfg.pulls.status.size.exclude.includes(file.filename),
    )
    .reduce((sum, file) => sum + file.changes, 0);

  let label = sizeLabels.keys().next().value;
  assertDefined(label);

  for (const [name, size] of sizeLabels.entries()) {
    if (changes > size) label = name;
  }

  pullLabels.push(label);

  if (pullLabels.toSorted() === labels.toSorted()) {
    return labels;
  }

  return pullLabels;
}

export const assign = function (
  this: Client,
  payload: components["schemas"]["webhook-pull-request-review-submitted"],
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const reviewer = payload.sender.login;
  const number = payload.pull_request.number;

  void this.issues.addAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [reviewer],
  });
};

export const update = async function (
  this: Client,
  pull:
    | components["schemas"]["pull-request-simple"]
    | components["schemas"]["webhook-pull-request-synchronize"]["pull_request"],
  repo: components["schemas"]["repository"],
) {
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const warnings = new Map<
    string,
    (
      pull:
        | components["schemas"]["pull-request-simple"]
        | components["schemas"]["webhook-pull-request-synchronize"]["pull_request"],
      repo: components["schemas"]["repository"],
    ) => Promise<boolean>
  >([
    [
      "mergeConflictWarning",
      async () => {
        const pullInfo = await this.pulls.get({
          owner: repoOwner,
          repo: repoName,
          pull_number: number,
        });
        return pullInfo.data.mergeable ?? false;
      },
    ],
    [
      "fixCommitWarning",
      async (pull, repo) => {
        const references = new Search(this, pull, repo);
        const bodyReferences = await references.getBody();
        const commitReferences = await references.getCommits();
        return bodyReferences.every((r) => commitReferences.includes(r));
      },
    ],
  ]);

  for (const [name, check] of warnings) {
    const template = this.templates.get(name);
    assertDefined(template);
    const deletable = await check(pull, repo);
    if (!deletable) continue;

    const { label } = this.cfg.pulls.status.mergeConflicts;

    if (label) {
      try {
        await this.issues.removeLabel({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          name: label,
        });
      } catch {
        // although we could attempt to fetch labels of the pull request,
        // it's an extra API call, so we silently ignore the error instead.
      }
    }

    const comments = await template.getComments({
      issue_number: number,
      owner: repoOwner,
      repo: repoName,
    });

    if (comments.length === 0) continue;

    for (const comment of comments) {
      void this.issues.deleteComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: comment.id,
      });
    }
  }
};
