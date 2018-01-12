exports.run = async function(comment, issue, repository) {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const number = issue.number;

  if (issue.assignees.find(assignee => assignee.login === commenter)) {
    const error = "**ERROR:** You have already claimed this issue.";
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
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

    if (this.invites.get(commenter)) return;

    this.repos.addCollaborator({
      owner: repoOwner, repo: repoName, username: commenter, permission: perm
    });

    this.invites.set(commenter, `${repoOwner}/${repoName}#${number}`);
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

    this.issues.createComment({
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
exports.args = false;
