import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertDefined } from "ts-extras";
import type { Bot } from "../../bot.ts";
import Search from "../../structures/reference-search.ts";

export const run = async function (
  bot: Bot,
  pull: EmitterWebhookEvent<
    "pull_request.opened" | "pull_request.synchronize"
  >["payload"]["pull_request"],
  repo: EmitterWebhookEvent<"pull_request">["payload"]["repository"],
  isOpened: boolean,
) {
  const author = pull.user?.login;
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const references = new Search(bot, pull, repo);
  const bodyReferences = await references.getBody();
  const commitReferences = await references.getCommits();

  const missingReferences = bodyReferences.filter(
    (r) => !commitReferences.includes(r),
  );

  const template = bot.templates.get("fixCommitWarning");
  assertDefined(template);
  const comments = await template.getComments({
    issue_number: number,
    owner: repoOwner,
    repo: repoName,
  });

  if (comments.length === 0 && missingReferences.length > 0) {
    const comment = template.format({
      author,
      issues: missingReferences.join(", #"),
      fixIssues: missingReferences.join(", fixes #"),
      issuePronoun: missingReferences.length > 1 ? "them" : "it",
    });
    await bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
    return;
  }

  if (!isOpened || bot.cfg.pulls.references.labels !== false) return;

  for (const issue of commitReferences) {
    await labelReference(bot, issue, number, repo);
  }
};

async function labelReference(
  bot: Bot,
  referencedIssue: number,
  number: number,
  repo: EmitterWebhookEvent<"pull_request">["payload"]["repository"],
) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const labelCfg = bot.cfg.pulls.references.labels;

  const response = await bot.octokit.issues.listLabelsOnIssue({
    owner: repoOwner,
    repo: repoName,
    issue_number: referencedIssue,
  });

  let labels = response.data.map((label) => label.name);

  if (typeof labelCfg === "object") {
    if (
      Number(labelCfg.include !== undefined) +
        Number(labelCfg.exclude !== undefined) !==
      1
    ) {
      const error = "**ERROR:** Invalid `references.labels` configuration.";
      await bot.octokit.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: error,
      });
      return;
    }

    if (labelCfg.include !== undefined) {
      labels = labels.filter((label) => labelCfg.include.includes(label));
    }

    if (labelCfg.exclude !== undefined) {
      labels = labels.filter((label) => !labelCfg.exclude.includes(label));
    }
  }

  await bot.octokit.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    labels,
  });
}
