const snekfetch = require("snekfetch");

exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const assignees = issue.assignees.map(assignee => assignee.login);
  if (!assignees.includes(commenter)) return client.newComment(issue, repository, "**ERROR:** You have not claimed this issue to work on yet.");
  exports.abandon(client, commenter, repoOwner, repoName, issueNumber);
};

exports.abandon = (client, commenter, repoOwner, repoName, issueNumber) => {
  const auth = new Buffer(client.cfg.username + ":" + client.cfg.password, "ascii").toString("base64");
  const json = JSON.stringify({
    assignees: commenter
  });
  snekfetch.delete(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`)
  .set("content-type", "application/json").set("content-length", json.length).set("authorization", `Basic ${auth}`)
  .set("accept", "application/json").set("user-agent", client.cfg.username).send(json)
  .then((r) => {
    const response = JSON.parse(r.text);
    if (!response.labels.find(label => label.name === client.cfg.inProgressLabel) || response.assignees.length !== 0) return;
    client.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel});
  });
};

exports.aliases = require("../config.js").abandonCommands;
exports.args = false;
