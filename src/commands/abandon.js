exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const assignees = issue.assignees.map(assignee => assignee.login);

  if (!assignees.includes(commenter)) {
    const error = "**ERROR:** You have not claimed this issue to work on yet.";
    return client.newComment(issue, repository, error);
  }

  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  const assignee = JSON.stringify({
    assignees: commenter
  });

  client.issues.removeAssigneesFromIssue({
    owner: repoOwner, repo: repoName, number: issue.number, body: assignee
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.assign.abandon.aliases;
exports.args = false;
