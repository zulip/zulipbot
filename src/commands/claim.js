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
    const comment = this.templates.get("multipleClaimWarning")
      .replace(new RegExp("{commenter}", "g"), commenter);

    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }

  try {
    await this.repos.checkCollaborator({
      owner: repoOwner, repo: repoName, username: commenter
    });

    const firstPage = await this.repos.getContributors({
      owner: repoOwner, repo: repoName
    });
    const contributors = await this.getAll(firstPage);

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

    const labels = payload.issue.labels.map(label => label.name);

    const warn = this.cfg.issues.commands.assign.newContributors.warn;
    const present = warn.labels.some(label => labels.includes(label));
    const absent = warn.labels.every(label => !labels.includes(label));
    const alert = warn.presence ? present : absent;

    if (!args.includes("--force") && alert) {
      const one = warn.labels.length === 1;
      const comment = this.templates.get("claimWarning")
        .replace(new RegExp("{username}", "g"), this.cfg.auth.username)
        .replace(new RegExp("{commenter}", "g"), commenter)
        .replace(new RegExp("{state}", "g"), warn.presence ? "with" : "without")
        .replace(new RegExp("{labelGrammar}", "g"), `label${one ? "" : "s"}`)
        .replace(new RegExp("{repoName}", "g"), repoName)
        .replace(new RegExp("{repoOwner}", "g"), repoOwner)
        .replace(new RegExp("{list}", "g"), `"${warn.labels.join("\", \"")}"`);

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

    const comment = this.templates.get("newContributor")
      .replace(new RegExp("{commenter}", "g"), commenter)
      .replace(new RegExp("{repoName}", "g"), repoName)
      .replace(new RegExp("{repoOwner}", "g"), repoOwner);

    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });

    const inviteKey = `${commenter}@${repoOwner}/${repoName}`;

    if (this.invites.get(inviteKey)) {
      const error = this.templates.get("inviteError")
        .replace(new RegExp("{commenter}", "g"), commenter)
        .replace(new RegExp("{repoName}", "g"), repoName)
        .replace(new RegExp("{repoOwner}", "g"), repoOwner);

      return this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: error
      });
    }

    await this.repos.addCollaborator({
      owner: repoOwner, repo: repoName, username: commenter, permission: perm
    });

    this.invites.set(inviteKey, number);
  }
};

async function validate(commenter, number, repoOwner, repoName) {
  const firstPage = await this.issues.getAll({
    filter: "all", per_page: 100,
    labels: this.cfg.activity.issues.inProgress
  });
  const issues = await this.getAll(firstPage);

  const limit = this.cfg.issues.commands.assign.newContributors.restricted;
  const assigned = issues.filter(issue => {
    return issue.assignees.find(assignee => assignee.login === commenter);
  });

  if (assigned.length >= limit) {
    const comment = this.templates.get("claimRestricted")
      .replace(new RegExp("{commenter}", "g"), commenter)
      .replace(new RegExp("{limit}", "g"), limit)
      .replace(new RegExp("{issue}", "g"), `issue${limit === 1 ? "" : "s"}`);

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

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.assign.claim;
