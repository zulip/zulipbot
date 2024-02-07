async function checkLabels(payload, commenter, args) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  const labels = new Set(payload.issue.labels.map((label) => label.name));
  const warn = this.cfg.issues.commands.assign.warn;
  const present = warn.labels.some((label) => labels.has(label));
  const absent = warn.labels.every((label) => !labels.has(label));
  const alert = warn.presence ? present : absent;

  if (alert && (!warn.force || (warn.force && !args.includes("--force")))) {
    const one = warn.labels.length === 1;
    const type = warn.force ? "claimWarning" : "claimBlock";
    const comment = this.templates.get(type).format({
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

export const run = async function (payload, commenter, args) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const limit = this.cfg.issues.commands.assign.limit;

  if (
    payload.issue.assignees.some((assignee) => assignee.login === commenter)
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
    const warn = this.templates
      .get("multipleClaimWarning")
      .format({ commenter });
    return this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: warn,
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
    if (error.status !== 404) {
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

  const contributors = await this.util.getAllPages("repos.listContributors", {
    owner: repoOwner,
    repo: repoName,
  });

  if (contributors.some((c) => c.login === commenter)) {
    return claim.call(this, commenter, number, repoOwner, repoName);
  }

  return validate.call(this, commenter, number, repoOwner, repoName);
};

async function invite(payload, commenter) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  const inviteKey = `${commenter}@${repoOwner}/${repoName}`;

  if (this.invites.has(inviteKey)) {
    const error = this.templates.get("inviteError").format({
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

  const comment = this.templates.get("contributorAddition").format({
    commenter,
    repoName,
    repoOwner,
  });

  this.issues.createComment({
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

async function validate(commenter, number, repoOwner, repoName) {
  const issues = await this.util.getAllPages("issues.list", {
    filter: "all",
    labels: this.cfg.activity.issues.inProgress,
  });

  const limit = this.cfg.issues.commands.assign.newContributors.restricted;
  const assigned = issues.filter((issue) =>
    issue.assignees.find((assignee) => assignee.login === commenter),
  );

  if (assigned.length >= limit) {
    const comment = this.templates.get("claimRestriction").format({
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

async function claim(commenter, number, repoOwner, repoName) {
  const response = await this.issues.addAssignees({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    assignees: [commenter],
  });

  if (response.data.assignees.length > 0) return;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  return this.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
    body: error,
  });
}

export const aliasPath = "assign.claim";
