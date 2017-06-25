const addLabels = require("./issues/label.js");
const claimIssue = require("./issues/claim.js");
const abandonIssue = require("./issues/abandon.js");
const removeLabels = require("./issues/remove.js");
const issueAreaLabeled = require("./issues/areaLabel.js");

module.exports = exports = (payload, client) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const issueCreator = issue.user.login;
  const payloadBody = payload.comment || issue;
  if (action === "labeled" && client.cfg.areaLabels) return issueAreaLabeled.run(client, issue, repository, payload.label);
  else if (action === "closed") return exports.closeIssue(client, issue, repository);
  else if (action !== "opened" && action !== "created") return;
  const commenter = payloadBody.user.login;
  const body = payloadBody.body;
  if (commenter === client.cfg.username || !body) return;
  const commands = body.match(new RegExp("@" + client.cfg.username + "\\s(\\w*)", "g"));
  if (!commands) return;
  commands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    const commandName = command.split(" ")[1];
    if (client.cfg.claimCommands.includes(commandName)) claimIssue.run(client, payloadBody, issue, repository);
    else if (client.cfg.abandonCommands.includes(commandName)) abandonIssue.run(client, payloadBody, issue, repository);
    else if ((client.cfg.selfLabelingOnly && commenter !== issueCreator) || !body.match(/".*?"/g)) return;
    const splitBody = body.split(`@${client.cfg.username}`).filter(splitString => splitString.includes(` ${commandName} "`)).join(" ");
    if (client.cfg.labelCommands.includes(commandName)) addLabels.run(client, splitBody, issue, repository);
    else if (client.cfg.removeCommands.includes(commandName)) removeLabels.run(client, splitBody, issue, repository);
  });
};

exports.closeIssue = (client, issue, repository) => {
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const hasInProgressLabel = issue.labels.find(label => label.name === client.cfg.inProgressLabel);
  if (hasInProgressLabel) client.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel});
};
