import type { components } from "@octokit/openapi-webhooks-types";
import { assertDefined } from "ts-extras";

import type { Client } from "../../client.ts";
import Search from "../../structures/reference-search.ts";

export const run = async function (
  this: Client,
  pull:
    | components["schemas"]["pull-request"]
    | components["schemas"]["webhook-pull-request-synchronize"]["pull_request"]
    | components["schemas"]["pull-request-webhook"],
  repo: components["schemas"]["repository-webhooks"],
  opened: boolean,
) {
  const author = pull.user?.login;
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const references = new Search(this, pull, repo);
  const bodyReferences = await references.getBody();
  const commitReferences = await references.getCommits();

  const missingReferences = bodyReferences.filter(
    (r) => !commitReferences.includes(r),
  );

  const template = this.templates.get("fixCommitWarning");
  assertDefined(template);
  const comments = await template.getComments({
    issue_number: number,
    owner: repoOwner,
    repo: repoName,
  });

  if (comments.length === 0 && missingReferences.length > 0) {
    const comment = template.format({
      author: author,
      issues: missingReferences.join(", #"),
      fixIssues: missingReferences.join(", fixes #"),
      issuePronoun: missingReferences.length > 0 ? "them" : "it",
    });
    await this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
    return;
  }

  if (!opened || !this.cfg.pulls.references.labels) return;

  for (const issue of commitReferences) {
    void labelReference.call(this, issue, number, repo);
  }
};

async function labelReference(
  this: Client,
  referencedIssue: number,
  number: number,
  repo: components["schemas"]["repository-webhooks"],
) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const labelCfg = this.cfg.pulls.references.labels;

  const response = await this.issues.listLabelsOnIssue({
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
      await this.issues.createComment({
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

  void this.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    labels: labels,
  });
}
