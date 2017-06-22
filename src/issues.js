"use strict"; // catch errors easier

const addLabels = require("./issues/label.js"); // add labels
const claimIssue = require("./issues/claim.js"); // claim issue
const abandonIssue = require("./issues/abandon.js"); // abandon issue
const removeLabels = require("./issues/remove.js"); // remove labels
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const checkPullRequestComment = require("./issues/checkPullRequestComment.js"); // check if comment belongs to PR
const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team

module.exports = exports = (payload, client) => {
  // get necessary information from request body
  const action = payload.action;
  const issueLabelArray = payload.issue.labels;
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  let commenter, body, addedLabel; // initialize variables for commenter, issue (comment) body, and added label
  if (action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  } else if (action === "labeled" && client.cfg.areaLabels) {
    addedLabel = payload.label.name;
    return issueAreaLabeled(client, addedLabel, issueNumber, repoName, repoOwner, issueLabelArray); // check if issue labeled with area label
  } else if (action === "closed") {
    const hasInProgressLabel = issueLabelArray.find(issueLabel => issueLabel.name === client.cfg.inProgressLabel);
    if (hasInProgressLabel) return client.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel});
  } else return;
  if (commenter === client.cfg.username) return;
  if (!body) return; // if body is empty
  const commands = body.match(new RegExp("@" + client.cfg.username + "\\s(\\w*)", "g"));
  if (!commands) return; // if there is no command
  if (body.match(/#([0-9]+)/) && client.cfg.areaLabels) checkPullRequestComment(client, body, issueNumber, repoName, repoOwner); // check if comment is from PR
  commands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    const commandName = command.split(" ")[1];
    if (client.cfg.claimCommands.includes(commandName)) claimIssue.run(client, payloadBody, issue, repository); // check body content for "@zulipbot claim"
    else if (client.cfg.abandonCommands.includes(commandName)) abandonIssue.run(client, payloadBody, issue, repository);
    else if (client.cfg.selfLabelingOnly && commenter !== issueCreator) return;
    const splitBody = body.split(`@${client.cfg.username}`).filter((splitString) => {
      return splitString.includes(` ${commandName} "`);
    }).join(" ");
    if (!body.match(/".*?"/g)) return;
    if (client.cfg.labelCommands.includes(commandName)) addLabels.run(client, splitBody, issue, repository);
    else if (client.cfg.removeCommands.includes(commandName)) removeLabels.run(client, splitBody, issue, repository);
    else if (client.cfg.joinCommands.includes(commandName) && client.cfg.areaLabels) joinLabelTeam(client, splitBody, commenter, repoOwner, repoName, issueNumber); // check body content for "@zulipbot join"
  });
};
