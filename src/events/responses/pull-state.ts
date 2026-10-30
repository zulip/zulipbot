import type { components } from "@octokit/openapi-types";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import _ from "lodash";
import { assertDefined, assertPresent } from "ts-extras";
import type { Bot } from "../../bot.ts";
import Search from "../../structures/reference-search.ts";

export const addLabels = async function (
  bot: Bot,
  payload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"],
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.pull_request.number;
  const action = payload.action;

  const response = await bot.octokit.issues.listLabelsOnIssue({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  let labels = response.data.map((label) => label.name);
  const oldLabels = labels;
  const shouldAutoUpdate = bot.cfg.activity.pulls.autoUpdate;
  const sizeLabels = bot.cfg.pulls.status.size.labels;

  if (shouldAutoUpdate) {
    const author = payload.pull_request.user?.login;
    const reviewer = "review" in payload ? payload.review.user?.login : null;
    labels = review(bot, labels, action, author, reviewer);
  }

  if (sizeLabels && (action === "opened" || action === "synchronize")) {
    labels = addSize(sizeLabels, labels, payload.pull_request);
  }

  if (!_.isEqual(oldLabels.toSorted(), labels.toSorted())) {
    await bot.octokit.issues.setLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels,
    });
  }
};

function review(
  bot: Bot,
  labels: string[],
  action: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"]["action"],
  author: string | undefined,
  reviewer: string | null | undefined,
) {
  const needsReviewLabel = bot.cfg.activity.pulls.needsReview.label;
  assertPresent(needsReviewLabel);
  const reviewedLabel = bot.cfg.activity.pulls.reviewed.label;
  assertPresent(reviewedLabel);
  const isNeedsReview = labels.includes(needsReviewLabel);
  const isReviewed = labels.includes(reviewedLabel);

  if (action === "opened" || action === "reopened") {
    labels.push(needsReviewLabel);
  } else if (action === "submitted" && isNeedsReview && reviewer !== author) {
    labels[labels.indexOf(needsReviewLabel)] = reviewedLabel;
  } else if (action === "synchronize" && isReviewed) {
    labels[labels.indexOf(reviewedLabel)] = needsReviewLabel;
  } else if (action === "closed" && isReviewed) {
    labels = labels.toSpliced(labels.indexOf(reviewedLabel), 1);
  } else if (action === "closed" && isNeedsReview) {
    labels = labels.toSpliced(labels.indexOf(needsReviewLabel), 1);
  }

  return labels;
}

function addSize(
  sizeLabels: Map<string, number>,
  labels: string[],
  pull: EmitterWebhookEvent<
    "pull_request.opened" | "pull_request.synchronize"
  >["payload"]["pull_request"],
) {
  const pullLabels = labels.filter((label) => !sizeLabels.has(label));
  const changes = (pull.additions ?? 0) + (pull.deletions ?? 0);

  let label = sizeLabels.keys().next().value;
  assertDefined(label);

  for (const [name, size] of sizeLabels) {
    if (changes > size) label = name;
  }

  pullLabels.push(label);

  return pullLabels;
}

export const assign = async function (
  bot: Bot,
  payload: components["schemas"]["webhook-pull-request-review-submitted"],
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const reviewer = payload.sender.login;
  const number = payload.pull_request.number;

  await bot.octokit.issues.addAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [reviewer],
  });
};

export const update = async function (
  bot: Bot,
  pull:
    | components["schemas"]["pull-request-simple"]
    | components["schemas"]["webhook-pull-request-synchronize"]["pull_request"],
  repo: components["schemas"]["repository"],
) {
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const warnings = new Map<string, () => Promise<boolean>>([
    [
      "mergeConflictWarning",
      async () => {
        const pullInfo = await bot.octokit.pulls.get({
          owner: repoOwner,
          repo: repoName,
          pull_number: number,
        });
        return pullInfo.data.mergeable ?? false;
      },
    ],
    [
      "fixCommitWarning",
      async () => {
        const references = new Search(bot, pull, repo);
        const bodyReferences = await references.getBody();
        const commitReferences = await references.getCommits();
        return bodyReferences.every((r) => commitReferences.includes(r));
      },
    ],
  ]);

  for (const [name, check] of warnings) {
    const template = bot.templates.get(name);
    assertDefined(template);
    const shouldDelete = await check();
    if (!shouldDelete) continue;

    const { label } = bot.cfg.pulls.status.mergeConflicts;

    if (label !== null) {
      try {
        await bot.octokit.issues.removeLabel({
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
      await bot.octokit.issues.deleteComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: comment.id,
      });
    }
  }
};
