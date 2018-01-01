exports.run = async function(client, comment, issue, repository) {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  if (issue.assignees.find(assignee => assignee.login === commenter)) {
    const error = "**ERROR:** You have already claimed this issue.";
    return client.newComment(issue, repository, error);
  }

  try {
    await client.repos.checkCollaborator({
      owner: repoOwner, repo: repoName, username: commenter
    });
    exports.claimIssue(client, comment, issue, repository);
  } catch (response) {
    if (response.code !== 404) {
      const error = "**ERROR:** Unexpected response from GitHub API.";
      return client.newComment(issue, repository, error);
    }

    const perm = client.cfg.issues.commands.assign.newContributors.permission;

    if (!perm) {
      const error = "**ERROR:** `addCollabPermission` wasn't configured.";
      return client.newComment(issue, repository, error);
    }

    const newComment = client.templates.get("newContributor")
      .replace(new RegExp("{commenter}", "g"), commenter)
      .replace(new RegExp("{repoName}", "g"), repoName)
      .replace(new RegExp("{repoOwner}", "g"), repoOwner);

    client.newComment(issue, repository, newComment);

    if (client.invites.get(commenter)) return;

    client.repos.addCollaborator({
      owner: repoOwner, repo: repoName, username: commenter, permission: perm
    });

    client.invites.set(commenter, `${repoOwner}/${repoName}#${issue.number}`);
  }
};

exports.claimIssue = async function(client, comment, issue, repository) {
  const commenter = comment.user.login;
  const number = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  const response = await client.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [commenter]
  });

  if (response.data.assignees.length) return;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  client.newComment(issue, repository, error);
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.assign.claim;
exports.args = false;
