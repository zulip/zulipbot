exports.run = async function(payload, commenter, args) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const limit = this.cfg.issues.commands.assign.limit;

  if (payload.issue.assignees.find(assignee => assignee.login === commenter)) {
    const error = "**ERROR:** You have already claimed this issue.";
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  if (payload.issue.assignees.length >= limit) {
    const warn = this.templates.get("multipleClaimWarning").format({commenter});
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: warn
    });
  }

  try {
    await this.repos.checkCollaborator({
      owner: repoOwner, repo: repoName, username: commenter
    });

    const contributors = await this.util.getAllPages("repos.getContributors", {
      owner: repoOwner, repo: repoName
    });

    if (contributors.find(c => c.login === commenter)) {
      claim.apply(this, [commenter, number, repoOwner, repoName]);
    } else {
      validate.apply(this, [commenter, number, repoOwner, repoName]);
    }
  } catch (response) {
    if (response.code !== 404) {
      const error = "**ERROR:** Unexpected response from GitHub API.";
      return this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: error
      });
    }

    invite.apply(this, [payload, commenter, args]);
  }
};

async function invite(payload, commenter, args) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;

  const inviteKey = `${commenter}@${repoOwner}/${repoName}`;

  if (this.invites.get(inviteKey)) {
    const error = this.templates.get("inviteError").format({
      commenter, repoName, repoOwner
    });

    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  const labels = payload.issue.labels.map(label => label.name);
  const warn = this.cfg.issues.commands.assign.newContributors.warn;
  const present = warn.labels.some(label => labels.includes(label));
  const absent = warn.labels.every(label => !labels.includes(label));
  const alert = warn.presence ? present : absent;

  if (alert && (!warn.force || (warn.force && !args.includes("--force")))) {
    const one = warn.labels.length === 1;
    const type = warn.force ? "claimWarning" : "claimBlock";
    const comment = this.templates.get(type).format({
      username: this.cfg.auth.username,
      state: warn.presence ? "with" : "without",
      labelGrammar: `label${one ? "" : "s"}`,
      list: `"${warn.labels.join("\", \"")}"`,
      commenter: commenter,
      repoName: repoName,
      repoOwner: repoOwner
    });

    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }

  const perm = this.cfg.issues.commands.assign.newContributors.permission;

  if (!perm) {
    const error = "**ERROR:** `addCollabPermission` wasn't configured.";
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  const comment = this.templates.get("contributorAddition").format({
    commenter, repoName, repoOwner
  });

  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: comment
  });

  await this.repos.addCollaborator({
    owner: repoOwner, repo: repoName, username: commenter, permission: perm
  });

  this.invites.set(inviteKey, number);
}

async function validate(commenter, number, repoOwner, repoName) {
  const issues = await this.util.getAllPages("issues.getAll", {
    filter: "all", labels: this.cfg.activity.issues.inProgress
  });

  const limit = this.cfg.issues.commands.assign.newContributors.restricted;
  const assigned = issues.filter(issue => {
    return issue.assignees.find(assignee => assignee.login === commenter);
  });

  if (assigned.length >= limit) {
    const comment = this.templates.get("claimRestriction").format({
      issue: `issue${limit === 1 ? "" : "s"}`,
      limit: limit,
      commenter: commenter
    });

    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }

  claim.apply(this, [commenter, number, repoOwner, repoName]);
}

async function claim(commenter, number, repoOwner, repoName) {
  const response = await this.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [commenter]
  });

  if (response.data.assignees.length) return;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
}

exports.aliasPath = "assign.claim";
