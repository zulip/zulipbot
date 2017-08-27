exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const assignees = issue.assignees.map(assignee => assignee.login);
  if (!assignees.includes(commenter)) {
    return client.newComment(issue, repository, "**ERROR:** You have not claimed this issue to work on yet.");
  }
  const assignee = JSON.stringify({
    assignees: commenter
  });
  client.issues.removeAssigneesFromIssue({
    owner: repository.owner.login, repo: repository.name, number: issue.number, body: assignee
  });
};

exports.aliases = require("../config.js").abandonCommands;
exports.args = false;
