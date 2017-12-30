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

    const func = client.repos.getContributors({
      owner: repoOwner, repo: repoName
    });
    const contributors = await client.getAll(client, [], func);

    if (contributors.find(c => c.login === commenter)) {
      exports.claimIssue(client, commenter, issue, repository);
    } else {
      exports.checkValid(client, commenter, issue, repository);
    }
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

exports.checkValid = async function(client, commenter, issue, repository) {
  const func = client.issues.getAll({
    filter: "all", per_page: 100,
    labels: client.cfg.activity.issues.inProgress
  });
  const issues = await client.getAll(client, [], func);

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

exports.claimIssue = async function(client, commenter, issue, repository) {
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
