import type { components } from "@octokit/openapi-types";
import { assertDefined } from "ts-extras";
import type { Client } from "../client.ts";
import Search from "../structures/reference-search.ts";

export const run = async function (this: Client) {
  const referenceList = new Map<string, number>();
  const repos = this.cfg.activity.check.repositories;

  // Process each repository sequentially to limit memory usage
  for (const repo of repos) {
    const [repoOwner, repoName] = repo.split("/");
    assertDefined(repoOwner);
    assertDefined(repoName);

    for await (const response of this.paginate.iterator(this.pulls.list, {
      owner: repoOwner,
      repo: repoName,
    })) {
      await scrapePulls.call(this, response.data, referenceList);
    }
  }

  await scrapeInactiveIssues.call(this, referenceList);
};

async function scrapePulls(
  this: Client,
  pulls: Array<components["schemas"]["pull-request-simple"]>,
  referenceList: Map<string, number>,
) {
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

    const labels = new Set<string | null>(
      response.data.map((label) => label.name),
    );

    const inactive = labels.has(this.cfg.activity.inactive);
    const reviewed = labels.has(this.cfg.activity.pulls.reviewed.label);
    const needsReview = labels.has(this.cfg.activity.pulls.needsReview.label);

    if (time + ims <= Date.now() && !inactive && reviewed) {
      await checkInactivePull.call(this, pull);
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
    author,
  });

  const comments = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  if (comments.length === 0) {
    await this.issues.createComment({
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
) {
  const ms = (this.cfg.activity.check.limit ?? 0) * 86400000;
  const ims = (this.cfg.activity.check.reminder ?? 0) * 86400000;

  for await (const response of this.paginate.iterator(this.issues.list, {
    filter: "all",
    labels: this.cfg.activity.issues.inProgress ?? undefined,
  })) {
    for (const issue of response.data) {
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
        continue;
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
        await this.issues.removeAssignees({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          assignees: logins,
        });

        const abandonTemplate = this.templates.get("abandonWarning");
        assertDefined(abandonTemplate);
        const warning = abandonTemplate.format({
          assignee: logins.join(", @"),
          total: (ms + ims) / 86400000,
          username: this.cfg.auth.username,
        });

        const id = comments[0].id;
        await this.issues.updateComment({
          owner: repoOwner,
          repo: repoName,
          comment_id: id,
          body: warning,
        });
      } else if (time + ims <= Date.now()) {
        await this.issues.createComment({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          body: comment,
        });
      }
    }
  }
}
