import { RequestError } from "@octokit/request-error";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { assertDefined } from "ts-extras";
import type { Bot } from "../bot.ts";
import { hideComment, isExempt } from "../structures/off-topic.ts";
import type { CommandAliases, CommandPayload } from "./index.ts";

/**
 * Checks an issue's labels against `issues.commands.assign.warn`, e.g.
 * whether it has the "help wanted" label.
 */
export function isOpenForClaiming(
  bot: Bot,
  issue: { labels?: Array<{ name: string }> },
) {
  assertDefined(issue.labels);
  const labels = new Set(issue.labels.map((label) => label.name));
  const warn = bot.cfg.issues.commands.assign.warn;
  const isPresent = warn.labels.some((label) => labels.has(label));
  const isAbsent = warn.labels.every((label) => !labels.has(label));
  return !(warn.presence ? isPresent : isAbsent);
}

async function isLabeledForClaiming(
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
) {
  if (isOpenForClaiming(bot, payload.issue)) return true;

  // Members of the exempt team get neither the warning nor a hidden comment.
  const exempt = await isExempt(bot, payload.repository.owner.login, commenter);
  if (exempt === true) return false;

  await postClaimBlock(bot, payload, commenter);

  // A claim in an issue body can't be hidden, and if membership couldn't be
  // checked, the claim is left visible.
  if (exempt === false && "comment" in payload) {
    await hideComment(bot, payload.comment.node_id);
  }

  return false;
}

async function postClaimBlock(
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const warn = bot.cfg.issues.commands.assign.warn;

  const isOne = warn.labels.length === 1;
  const template = bot.templates.get("claimBlock");
  assertDefined(template);

  // Post the claimBlock warning at most once per issue. A hidden warning
  // still counts; a deleted one doesn't.
  const warnings = await template.getComments(
    { owner: repoOwner, repo: repoName, issue_number: number },
    // Matches warnings posted before the template had a trailing marker.
    "You have attempted to claim an issue without the label",
  );
  if (warnings.length > 0) return;

  assertDefined(bot.cfg.auth.username);
  const comment = template.format({
    username: bot.cfg.auth.username,
    state: warn.presence ? "with" : "without",
    labelGrammar: `label${isOne ? "" : "s"}`,
    list: `"${warn.labels.join('", "')}"`,
    commenter,
    repoName,
    repoOwner,
  });

  await bot.octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: comment,
  });
}

export const run = async function (
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
): Promise<
  | RestEndpointMethodTypes["issues"]["createComment"]["response"]
  | RestEndpointMethodTypes["repos"]["addCollaborator"]["response"]
  | undefined
> {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  if (
    payload.issue.assignees.some((assignee) => assignee?.login === commenter)
  ) {
    const error = "**ERROR:** You have already claimed this issue.";
    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (payload.issue.pull_request) {
    const template = bot.templates.get("claimPullRequest");
    assertDefined(template);
    const comment = template.format({
      commenter,
      repoName,
      repoOwner,
    });
    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }

  if (!(await isLabeledForClaiming(bot, payload, commenter))) {
    return;
  }

  // Checked after the labels, so that claims on an assigned issue that can't
  // be claimed anyway don't each get a reply.
  if (payload.issue.assignees.length >= bot.cfg.issues.commands.assign.limit) {
    const template = bot.templates.get("multipleClaimWarning");
    assertDefined(template);
    const warn = template.format({ commenter });
    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: warn,
    });
  }

  try {
    await bot.octokit.repos.checkCollaborator({
      owner: repoOwner,
      repo: repoName,
      username: commenter,
    });
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 404) {
      return bot.octokit.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: "**ERROR:** Unexpected response from GitHub API.",
      });
    }

    return invite(bot, payload, commenter);
  }

  // A commenter is considered a contributor if they have at least one commit
  // in the repository. So, fetching just one commit by the author is sufficient
  // to determine whether they are a contributor or not.
  const commenterCommitsResponse = await bot.octokit.repos.listCommits({
    owner: repoOwner,
    repo: repoName,
    author: commenter,
    per_page: 1,
  });

  return (
    commenterCommitsResponse.data.length > 0 // commenter is a contributor
      ? claim
      : validate
  )(bot, commenter, number, repoOwner, repoName);
};

async function invite(
  bot: Bot,
  payload: CommandPayload,
  commenter: string,
): Promise<
  | RestEndpointMethodTypes["issues"]["createComment"]["response"]
  | RestEndpointMethodTypes["repos"]["addCollaborator"]["response"]
> {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  const inviteKey = `${commenter}@${repoOwner}/${repoName}`;

  if (bot.invites.has(inviteKey)) {
    const template = bot.templates.get("inviteError");
    assertDefined(template);
    const error = template.format({
      commenter,
      repoName,
      repoOwner,
    });

    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  const perm = bot.cfg.issues.commands.assign.newContributors.permission;

  if (perm === null) {
    const error = "**ERROR:** `newContributors.permission` wasn't configured.";
    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  const template = bot.templates.get("contributorAddition");
  assertDefined(template);
  const comment = template.format({
    commenter,
    repoName,
    repoOwner,
  });

  await bot.octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: comment,
  });

  bot.invites.set(inviteKey, number);

  return bot.octokit.repos.addCollaborator({
    owner: repoOwner,
    repo: repoName,
    username: commenter,
    permission: perm,
  });
}

async function validate(
  bot: Bot,
  commenter: string,
  number: number,
  repoOwner: string,
  repoName: string,
) {
  const limit = bot.cfg.issues.commands.assign.newContributors.restricted;
  let assignedCount = 0;

  for await (const response of bot.octokit.paginate.iterator(
    bot.octokit.issues.list,
    {
      filter: "all",
      labels: bot.cfg.activity.issues.inProgress,
    },
  )) {
    for (const issue of response.data) {
      if (issue.assignees?.find((assignee) => assignee.login === commenter)) {
        assignedCount++;
      }
    }

    if (assignedCount >= limit) break;
  }

  if (assignedCount >= limit) {
    const template = bot.templates.get("claimRestriction");
    assertDefined(template);
    const comment = template.format({
      issue: `issue${limit === 1 ? "" : "s"}`,
      limit,
      commenter,
    });

    return bot.octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }

  return claim(bot, commenter, number, repoOwner, repoName);
}

async function claim(
  bot: Bot,
  commenter: string,
  number: number,
  repoOwner: string,
  repoName: string,
) {
  const response = await bot.octokit.issues.addAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [commenter],
  });

  if (
    response.data.assignees !== undefined &&
    response.data.assignees !== null &&
    response.data.assignees.length > 0
  ) {
    return;
  }

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  return bot.octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: error,
  });
}

export const aliasPath = (commands: CommandAliases) => commands.assign.claim;
