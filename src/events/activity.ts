import type { components } from "@octokit/openapi-types";
import { assertDefined } from "ts-extras";
import type { Bot } from "../bot.ts";
import Search from "../structures/reference-search.ts";

export const run = async function (bot: Bot) {
  const referenceList = new Map<string, number>();
  const repos = bot.cfg.activity.check.repositories;

  // Process each repository sequentially to limit memory usage
  for (const repo of repos) {
    const [repoOwner, repoName] = repo.split("/", 2);
    assertDefined(repoOwner);
    assertDefined(repoName);

    for await (const response of bot.octokit.paginate.iterator(
      bot.octokit.pulls.list,
      {
        owner: repoOwner,
        repo: repoName,
      },
    )) {
      await scrapePulls(bot, response.data, referenceList);
    }
  }

  await scrapeInactiveIssues(bot, referenceList);
};

async function scrapePulls(
  bot: Bot,
  pulls: Array<components["schemas"]["pull-request-simple"]>,
  referenceList: Map<string, number>,
) {
  const ims = (bot.cfg.activity.check.reminder ?? 0) * 86_400_000;

  for (const pull of pulls) {
    let time = Date.parse(pull.updated_at);
    const number = pull.number;
    const repoName = pull.base.repo.name;
    const repoOwner = pull.base.repo.owner.login;

    const response = await bot.octokit.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });

    const labels = new Set<string | null>(
      response.data.map((label) => label.name),
    );

    const isInactive = labels.has(bot.cfg.activity.inactive);
    const isReviewed = labels.has(bot.cfg.activity.pulls.reviewed.label);
    const isNeedsReview = labels.has(bot.cfg.activity.pulls.needsReview.label);
    const { underReview } = bot.cfg.activity.pulls;
    const isUnderReview = underReview.labels.some((label) => labels.has(label));

    if (!isInactive && isReviewed && time + ims <= Date.now()) {
      await checkInactivePull(bot, pull);
    }

    const references = new Search(bot, pull, pull.base.repo);
    const bodyReferences = await references.getBody();
    const commitReferences = await references.getCommits();

    if (bodyReferences.length === 0 && commitReferences.length === 0) continue;

    const references_ = [...commitReferences, ...bodyReferences];
    for (const reference of references_) {
      const shouldIgnore = bot.cfg.activity.pulls.needsReview.ignore;
      if (isNeedsReview && shouldIgnore) time = Date.now();
      if (isUnderReview && underReview.ignore) time = Date.now();
      referenceList.set(`${repoName}/${reference}`, time);
    }
  }
}

async function checkInactivePull(
  bot: Bot,
  pull: components["schemas"]["pull-request-simple"],
) {
  const author = pull.user?.login;
  const repoName = pull.base.repo.name;
  const repoOwner = pull.base.repo.owner.login;
  const number = pull.number;

  const template = bot.templates.get("updateWarning");
  assertDefined(template);

  const comment = template.format({
    days: bot.cfg.activity.check.reminder,
    author,
  });

  const comments = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  if (comments.length === 0) {
    await bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }
}

async function scrapeInactiveIssues(bot: Bot, references: Map<string, number>) {
  const ms = (bot.cfg.activity.check.limit ?? 0) * 86_400_000;
  const ims = (bot.cfg.activity.check.reminder ?? 0) * 86_400_000;

  for await (const response of bot.octokit.paginate.iterator(
    bot.octokit.issues.list,
    {
      filter: "all",
      labels: bot.cfg.activity.issues.inProgress ?? undefined,
    },
  )) {
    for (const issue of response.data) {
      const hasInactiveLabel = issue.labels.some(
        (label) =>
          (typeof label === "string" ? label : label.name) ===
          bot.cfg.activity.inactive,
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

      const isActive = bot.cfg.activity.check.repositories.includes(repoTag);

      if (!isActive || time + ms >= Date.now()) continue;

      if (
        issue.assignees === undefined ||
        issue.assignees === null ||
        issue.assignees.length === 0
      ) {
        const comment = "**ERROR:** This active issue has no assignee.";
        await bot.octokit.issues.createComment({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          body: comment,
        });
        continue;
      }

      const logins = issue.assignees.map((assignee) => assignee.login);

      const template = bot.templates.get("inactiveWarning");
      assertDefined(template);

      const comment = template.format({
        assignee: logins.join(", @"),
        remind: bot.cfg.activity.check.reminder,
        abandon: bot.cfg.activity.check.limit,
        username: bot.cfg.auth.username,
      });

      const comments = await template.getComments({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
      });

      if (comments[0] !== undefined) {
        await bot.octokit.issues.removeAssignees({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          assignees: logins,
        });

        const abandonTemplate = bot.templates.get("abandonWarning");
        assertDefined(abandonTemplate);
        const warning = abandonTemplate.format({
          assignee: logins.join(", @"),
          total: (ms + ims) / 86_400_000,
          username: bot.cfg.auth.username,
        });

        const id = comments[0].id;
        await bot.octokit.issues.updateComment({
          owner: repoOwner,
          repo: repoName,
          comment_id: id,
          body: warning,
        });
      } else if (time + ims <= Date.now()) {
        await bot.octokit.issues.createComment({
          owner: repoOwner,
          repo: repoName,
          issue_number: number,
          body: comment,
        });
      }
    }
  }
}
