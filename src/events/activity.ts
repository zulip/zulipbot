import type { components } from "@octokit/openapi-types";
import { assertDefined } from "ts-extras";

import type { Client } from "../client.ts";
import Search from "../structures/reference-search.ts";

export const run = async function (this: Client) {
  // Create array with PRs from all active repositories
  const repos = this.cfg.activity.check.repositories;
  const pages = repos.map(async (repo) => {
    const [repoOwner, repoName] = repo.split("/");
    assertDefined(repoOwner);
    assertDefined(repoName);
    return this.paginate(this.pulls.list, {
      owner: repoOwner,
      repo: repoName,
    });
  });

  const array = await Promise.all(pages);

  // Flatten arrays of arrays with PR data
  const pulls = array.flat();

  await scrapePulls.call(this, pulls);
};

async function scrapePulls(
  this: Client,
  pulls: Array<components["schemas"]["pull-request-simple"]>,
) {
  const referenceList = new Map<string, number>();
  const ims = (this.cfg.activity.check.reminder ?? 0) * 86400000;

  for (const pull of pulls) {
    let time = Date.parse(pull.updated_at);
    const number = pull.number;
    const repoName = pull.base.repo.name;
    const repoOwner = pull.base.repo.owner.login;

    const response = await this.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });

    const labels = response.data.map((label) => label.name);

    const inactive = labels.find(
      (label) => label === this.cfg.activity.inactive,
    );
    const reviewed = labels.find(
      (l) => l === this.cfg.activity.pulls.reviewed.label,
    );
    const needsReview = labels.find(
      (l) => l === this.cfg.activity.pulls.needsReview.label,
    );

    if (time + ims <= Date.now() && !inactive && reviewed) {
      void checkInactivePull.call(this, pull);
    }

    const references = new Search(this, pull, pull.base.repo);
    const bodyReferences = await references.getBody();
    const commitReferences = await references.getCommits();

    if (bodyReferences.length > 0 || commitReferences.length > 0) {
      const references_ = [...commitReferences, ...bodyReferences];
      for (const reference of references_) {
        const ignore = this.cfg.activity.pulls.needsReview.ignore;
        if (needsReview && ignore) time = Date.now();
        referenceList.set(`${repoName}/${reference}`, time);
      }
    }
  }

  const issues = await this.paginate(this.issues.list, {
    filter: "all",
    labels: this.cfg.activity.issues.inProgress ?? undefined,
  });

  await scrapeInactiveIssues.call(this, referenceList, issues);
}

async function checkInactivePull(
  this: Client,
  pull: components["schemas"]["pull-request-simple"],
) {
  const author = pull.user?.login;
  const repoName = pull.base.repo.name;
  const repoOwner = pull.base.repo.owner.login;
  const number = pull.number;

  const template = this.templates.get("updateWarning");
  assertDefined(template);

  const comment = template.format({
    days: this.cfg.activity.check.reminder,
    author: author,
  });

  const comments = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  if (comments.length === 0) {
    void this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }
}

async function scrapeInactiveIssues(
  this: Client,
  references: Map<string, number>,
  issues: Array<components["schemas"]["issue"]>,
) {
  const ms = (this.cfg.activity.check.limit ?? 0) * 86400000;
  const ims = (this.cfg.activity.check.reminder ?? 0) * 86400000;

  for (const issue of issues) {
    const hasInactiveLabel = issue.labels.some(
      (label) =>
        (typeof label === "string" ? label : label.name) ===
        this.cfg.activity.inactive,
    );
    if (hasInactiveLabel) continue;

    let time = Date.parse(issue.updated_at);
    const number = issue.number;
    assertDefined(issue.repository);
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    const issueTag = `${repoName}/${number}`;
    const repoTag = issue.repository.full_name;

    const reference = references.get(issueTag);
    if (reference !== undefined && time < reference) time = reference;

    const active = this.cfg.activity.check.repositories.includes(repoTag);

    if (time + ms >= Date.now() || !active) continue;

    if (
      issue.assignees === undefined ||
      issue.assignees === null ||
      issue.assignees.length === 0
    ) {
      const comment = "**ERROR:** This active issue has no assignee.";
      await this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: comment,
      });
      return;
    }

    const logins = issue.assignees.map((assignee) => assignee.login);

    const template = this.templates.get("inactiveWarning");
    assertDefined(template);

    const comment = template.format({
      assignee: logins.join(", @"),
      remind: this.cfg.activity.check.reminder,
      abandon: this.cfg.activity.check.limit,
      username: this.cfg.auth.username,
    });

    const comments = await template.getComments({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });

    if (comments[0] !== undefined) {
      void this.issues.removeAssignees({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        assignees: logins,
      });

      const template = this.templates.get("abandonWarning");
      assertDefined(template);
      const warning = template.format({
        assignee: logins.join(", @"),
        total: (ms + ims) / 86400000,
        username: this.cfg.auth.username,
      });

      const id = comments[0].id;
      void this.issues.updateComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: id,
        body: warning,
      });
    } else if (time + ims <= Date.now()) {
      void this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: comment,
      });
    }
  }
}
