"use strict"; // catch errors easier

const snekfetch = require("snekfetch");

exports.run = (github, comment, issue, repository) => {
  const commenter = comment.user.login;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const assignees = issue.assignees.map(assignee => assignee.login);
  if (!assignees.includes(commenter)) return; // return if commenter is not an assignee
  const auth = new Buffer(github.cfg.username + ":" + github.cfg.password, "ascii").toString("base64");
  const json = JSON.stringify({
    assignees: commenter
  });
  snekfetch.delete(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`)
  .set("content-type", "application/json")
  .set("content-length", json.length)
  .set("authorization", `Basic ${auth}`)
  .set("accept", "application/json")
  .set("user-agent", github.cfg.username)
  .send(json)
  .then((r) => {
    const response = JSON.parse(r.text);
    if (!response.labels.find(label => label.name === github.cfg.inProgressLabel) || response.assignees.length !== 0) return;
    github.issues.removeLabel({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      name: github.cfg.inProgressLabel
    });
  });
};
