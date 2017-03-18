"use strict"; // catch errors easier

const cfg = require("./config.js"); // config file
const addLabels = require("./issues/addLabels.js"); // add labels
const claimIssue = require("./issues/claimIssue.js"); // claim issue
const abandonIssue = require("./issues/abandonIssue.js"); // abandon issue
const removeLabels = require("./issues/removeLabels.js"); // remove labels
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const checkPullRequestComment = require("./issues/checkPullRequestComment.js"); // check if comment belongs to PR
const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  let commenter, body, addedLabel; // initialize variables for commenter, issue (comment) body, and added label
  if (action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  } else if (action === "labeled") {
    addedLabel = payload.label.name;
  } else return;
  const issueLabelArray = payload.issue.labels;
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (commenter === cfg.username) return;
  if (addedLabel && cfg.areaLabels) issueAreaLabeled(addedLabel, issueNumber, repoName, repoOwner, issueLabelArray); // check if issue labeled with area label
  if (!body) return; // if body is empty
  const command = body.match(new RegExp("@" + cfg.username + "\\s(\\w*)"), "");
  if (!command) return; // if there is no command
  if (body.match(/#([0-9]+)/) && cfg.areaLabels) checkPullRequestComment(body, issueNumber, repoName, repoOwner); // check if comment is from PR
  if (body.includes(`\`${command[0]}\``) || body.includes(`\`\`\`\r\n${command[0]}\r\n\`\`\``) || !body.match(`@${cfg.username} ${command[1]}`)) return;
  if (command[1] === "claim" && cfg.claimEnabled) claimIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot claim"
  else if (command[1] === "label" && cfg.labelEnabled && cfg.selfLabelingOnly && commenter === issueCreator) addLabels(body, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot label" and ensure commenter opened the issue
  else if ((command[1] === "abandon" || command[1] === "unclaim") && cfg.abandonEnabled) abandonIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot abandon" or "@zulipbot claim"
  else if (command[1] === "remove" && cfg.removeEnabled && cfg.selfLabelingOnly && commenter === issueCreator) removeLabels(body, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot remove" and ensure commenter opened the issue
  else if (command[1] === "join" && cfg.joinEnabled && cfg.areaLabels) joinLabelTeam(body, commenter, repoOwner, repoName, issueNumber);
};
