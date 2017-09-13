exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (issue.assignees && issue.assignees.find(assignee => assignee.login === commenter)) {
    return client.newComment(issue, repository, "**ERROR:** You have already claimed this issue.");
  }
  if (comment.author_association === "NONE" && !client.invites.get(commenter)) {
    exports.addCollaborator(client, comment, issue, repository);
  } else if (comment.author_association === "NONE") {
    const comment = client.templates.get("newContributor").replace("[commenter]", commenter)
    .replace("[repoName]", repoName).replace("[repoOwner]", repoOwner);
    client.newComment(issue, repository, comment);
  } else {
    exports.claimIssue(client, comment, issue, repository);
  }
};

exports.addCollaborator = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (!client.cfg.addCollabPermission) {
    const comment = "**ERROR:** `client.cfg.addCollabPermission` wasn't specified in `src/config.js`.";
    return client.newComment(issue, repository, comment);
  }
  client.repos.addCollaborator({
    owner: repoOwner, repo: repoName, username: commenter, permission: client.cfg.addCollabPermission
  }).then(() => {
    client.invites.set(commenter, `${repoOwner}/${repoName}#${issue.number}`);
    const comment = client.templates.get("newContributor").replace("[commenter]", commenter)
    .replace("[repoName]", repoName).replace("[repoOwner]", repoOwner);
    client.newComment(issue, repository, comment);
  });
};

exports.claimIssue = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: issueNumber, assignees: [commenter]
  }).then((response) => {
    if (response.data.assignees) return;
    client.newComment(issue, repository, "**ERROR:** Issue claiming failed (no assignee was added).");
  });
};

exports.aliases = require("../config.js").claimCommands;
exports.args = false;
