const newContributor = require("fs").readFileSync("./src/templates/newContributor.md", "utf8");

exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (issue.assignees && issue.assignees.find(assignee => assignee.login === commenter)) return client.newComment(issue, repository, "**ERROR:** You have already claimed this issue.");
  client.repos.checkCollaborator({owner: repoOwner, repo: repoName, username: commenter})
  .then((response) => {
    if (response.meta.status !== "204 No Content") return client.newComment(issue, repository, "**ERROR:** Unexpected response from GitHub API.");
    exports.claimIssue(client, comment, issue, repository);
  }, (response) => {
    if (response.headers.status !== "404 Not Found") return client.newComment(issue, repository, "**ERROR:** Unexpected response from GitHub API.");
    exports.addCollaborator(client, comment, issue, repository);
  });
};

exports.addCollaborator = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (!client.cfg.addCollabPermission) return client.newComment(issue, repository, "**ERROR:** No new collaborator permission was specified in `src/config.js`.");
  client.repos.addCollaborator({owner: repoOwner, repo: repoName, username: commenter, permission: client.cfg.addCollabPermission})
  .then(exports.claimIssue(client, comment, issue, repository, true));
};

exports.claimIssue = (client, comment, issue, repository, newContrib) => {
  const commenter = comment.user.login;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.issues.addAssigneesToIssue({owner: repoOwner, repo: repoName, number: issueNumber, assignees: [commenter]})
  .then(() => {
    if (newContrib) client.newComment(issue, repository, newContributor.replace("[commenter]", commenter));
    if (!client.cfg.inProgressLabel || issue.labels.find(label => label.name === client.cfg.inProgressLabel || issue.pull_request)) return;
    client.issues.addLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: [client.cfg.inProgressLabel]});
  });
};

exports.name = "claim";
exports.aliases = require("../config.js").claimCommands;
exports.args = false;
