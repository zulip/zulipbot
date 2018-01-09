exports.run = async function(client, comment, issue, repository) {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const number = issue.number;

  if (issue.assignees.find(assignee => assignee.login === commenter)) {
    const error = "**ERROR:** You have already claimed this issue.";
    return client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  try {
    await client.repos.checkCollaborator({
      owner: repoOwner, repo: repoName, username: commenter
    });

    const firstPage = await client.repos.getContributors({
      owner: repoOwner, repo: repoName
    });
    const contributors = await client.getAll(firstPage);

    if (contributors.find(c => c.login === commenter)) {
      exports.claimIssue(client, commenter, issue, repository);
    } else {
      exports.checkValid(client, commenter, issue, repository);
    }
  } catch (response) {
    if (response.code !== 404) {
      const error = "**ERROR:** Unexpected response from GitHub API.";
      return client.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: error
      });
    }

    const perm = client.cfg.issues.commands.assign.newContributors.permission;

    if (!perm) {
      const error = "**ERROR:** `addCollabPermission` wasn't configured.";
      return client.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: error
      });
    }

    const comment = client.templates.get("newContributor")
      .replace(new RegExp("{commenter}", "g"), commenter)
      .replace(new RegExp("{repoName}", "g"), repoName)
      .replace(new RegExp("{repoOwner}", "g"), repoOwner);

    client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });

    if (client.invites.get(commenter)) return;

    client.repos.addCollaborator({
      owner: repoOwner, repo: repoName, username: commenter, permission: perm
    });

    client.invites.set(commenter, `${repoOwner}/${repoName}#${number}`);
  }
};

exports.checkValid = async function(client, commenter, issue, repository) {
  const firstPage = await client.issues.getAll({
    filter: "all", per_page: 100,
    labels: client.cfg.activity.issues.inProgress
  });
  const issues = await client.getAll(firstPage);

  const limit = client.cfg.issues.commands.assign.newContributors.restricted;
  const assigned = issues.filter(issue => {
    return issue.assignees.find(assignee => assignee.login === commenter);
  });

  if (assigned.length >= limit) {
    const newComment = client.templates.get("claimRestricted")
      .replace(new RegExp("{commenter}", "g"), commenter)
      .replace(new RegExp("{limit}", "g"), limit)
      .replace(new RegExp("{issue}", "g"), `issue${limit === 1 ? "" : "s"}`);

    return client.newComment(issue, repository, newComment);
  }

  exports.claimIssue(client, commenter, issue, repository);
};

exports.claimIssue = async function(client, commenter, number, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  const response = await client.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [commenter]
  });

  if (response.data.assignees.length) return;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  client.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.assign.claim;
exports.args = false;
