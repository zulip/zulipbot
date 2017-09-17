exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (issue.assignees && issue.assignees.find(assignee => assignee.login === commenter)) {
    return client.newComment(issue, repository, "**ERROR:** You have already claimed this issue.");
  }
  client.repos.reviewUserPermissionLevel({
    owner: repoOwner, repo: repoName, username: commenter
  }).then((response) => {
    if (response.data.permission !== "none") return exports.claimIssue(client, comment, issue, repository);
    if (!client.cfg.addCollabPermission) {
      const newComment = "**ERROR:** `client.cfg.addCollabPermission` wasn't specified in `src/config.js`.";
      return client.newComment(issue, repository, newComment);
    }
    const newComment = client.templates.get("newContributor").replace("[commenter]", commenter)
    .replace("[repoName]", repoName).replace("[repoOwner]", repoOwner);
    client.newComment(issue, repository, newComment);
    if (client.invites.get(commenter)) return;
    client.repos.addCollaborator({
      owner: repoOwner, repo: repoName, username: commenter, permission: client.cfg.addCollabPermission
    }).then(() => {
      client.invites.set(commenter, `${repoOwner}/${repoName}#${issue.number}`);
    });
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
