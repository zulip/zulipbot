exports.run = (client, comment, issue, repository) => {
  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  const number = issue.number;
  const commenter = comment.user.login;
  const assignees = issue.assignees.map(assignee => assignee.login);

  if (!assignees.includes(commenter)) {
    const error = "**ERROR:** You have not claimed this issue to work on yet.";
    return client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  const assignee = JSON.stringify({
    assignees: commenter
  });

  client.issues.removeAssigneesFromIssue({
    owner: repoOwner, repo: repoName, number: number, body: assignee
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.assign.abandon;
exports.args = false;
