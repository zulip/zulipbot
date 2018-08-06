exports.run = function(payload, commenter) {
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const number = payload.issue.number;
  const assignees = payload.issue.assignees.map(assignee => assignee.login);

  if (!assignees.includes(commenter)) {
    const error = "**ERROR:** You have not claimed this issue to work on yet.";
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  return this.issues.removeAssigneesFromIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [commenter]
  });
};

exports.aliasPath = "assign.abandon";
