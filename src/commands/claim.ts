import { RequestError } from "@octokit/request-error";
import { assertDefined } from "ts-extras";

import type { Client } from "../client.ts";

import type { CommandAliases, CommandPayload } from "./index.ts";

async function checkLabels(
  this: Client,
  payload: CommandPayload,
  commenter: string,
  args: string,
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  assertDefined(payload.issue.labels);
  const labels = new Set(payload.issue.labels.map((label) => label.name));
  const warn = this.cfg.issues.commands.assign.warn;
  const present = warn.labels.some((label) => labels.has(label));
  const absent = warn.labels.every((label) => !labels.has(label));
  const alert = warn.presence ? present : absent;

  if (alert && (!warn.force || (warn.force && !args.includes("--force")))) {
    const one = warn.labels.length === 1;
    const type = warn.force ? "claimWarning" : "claimBlock";
    const template = this.templates.get(type);
    assertDefined(template);
    assertDefined(this.cfg.auth.username);
    const comment = template.format({
      username: this.cfg.auth.username,
      state: warn.presence ? "with" : "without",
      labelGrammar: `label${one ? "" : "s"}`,
      list: `"${warn.labels.join('", "')}"`,
      commenter: commenter,
      repoName: repoName,
      repoOwner: repoOwner,
    });

    await this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });

    return false;
  }

  return true;
}

export const run = async function (
  this: Client,
  payload: CommandPayload,
  commenter: string,
  args: string,
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const limit = this.cfg.issues.commands.assign.limit;

  if (
    payload.issue.assignees.some((assignee) => assignee?.login === commenter)
  ) {
    const error = "**ERROR:** You have already claimed this issue.";
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (payload.issue.assignees.length >= limit) {
    const template = this.templates.get("multipleClaimWarning");
    assertDefined(template);
    const warn = template.format({ commenter });
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: warn,
    });
  }

  if (payload.issue.pull_request) {
    const template = this.templates.get("claimPullRequest");
    assertDefined(template);
    const comment = template.format({
      commenter,
      repoName,
      repoOwner,
    });
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }

  if (!(await checkLabels.call(this, payload, commenter, args))) {
    return;
  }

  try {
    await this.repos.checkCollaborator({
      owner: repoOwner,
      repo: repoName,
      username: commenter,
    });
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 404) {
      const error = "**ERROR:** Unexpected response from GitHub API.";
      return this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: error,
      });
    }

    return invite.call(this, payload, commenter);
  }

  // A commenter is considered a contributor if they have at least one commit
  // in the repository. So, fetching just one commit by the author is sufficient
  // to determine whether they are a contributor or not.
  const commenterCommitsResponse = await this.repos.listCommits({
    owner: repoOwner,
    repo: repoName,
    author: commenter,
    per_page: 1,
  });

  if (commenterCommitsResponse.data.length > 0) {
    // commenter is a contributor
    return claim.call(this, commenter, number, repoOwner, repoName);
  }

  return validate.call(this, commenter, number, repoOwner, repoName);
};

async function invite(
  this: Client,
  payload: CommandPayload,
  commenter: string,
) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  const inviteKey = `${commenter}@${repoOwner}/${repoName}`;

  if (this.invites.has(inviteKey)) {
    const template = this.templates.get("inviteError");
    assertDefined(template);
    const error = template.format({
      commenter,
      repoName,
      repoOwner,
    });

    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  const perm = this.cfg.issues.commands.assign.newContributors.permission;

  if (!perm) {
    const error = "**ERROR:** `newContributors.permission` wasn't configured.";
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  const template = this.templates.get("contributorAddition");
  assertDefined(template);
  const comment = template.format({
    commenter,
    repoName,
    repoOwner,
  });

  void this.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: comment,
  });

  this.invites.set(inviteKey, number);

  return this.repos.addCollaborator({
    owner: repoOwner,
    repo: repoName,
    username: commenter,
    permission: perm,
  });
}

async function validate(
  this: Client,
  commenter: string,
  number: number,
  repoOwner: string,
  repoName: string,
) {
  const issues = await this.paginate(this.issues.list, {
    filter: "all",
    labels: this.cfg.activity.issues.inProgress,
  });

  const limit = this.cfg.issues.commands.assign.newContributors.restricted;
  const assigned = issues.filter((issue) =>
    issue.assignees?.find((assignee) => assignee.login === commenter),
  );

  if (assigned.length >= limit) {
    const template = this.templates.get("claimRestriction");
    assertDefined(template);
    const comment = template.format({
      issue: `issue${limit === 1 ? "" : "s"}`,
      limit: limit,
      commenter: commenter,
    });

    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }

  return claim.call(this, commenter, number, repoOwner, repoName);
}

async function claim(
  this: Client,
  commenter: string,
  number: number,
  repoOwner: string,
  repoName: string,
) {
  const response = await this.issues.addAssignees({
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

  return this.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: error,
  });
}

export const aliasPath = (commands: CommandAliases) => commands.assign.claim;
