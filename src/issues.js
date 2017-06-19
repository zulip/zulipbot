"use strict"; // catch errors easier

const addLabels = require("./issues/addLabels.js"); // add labels
const claimIssue = require("./issues/claimIssue.js"); // claim issue
const abandonIssue = require("./issues/abandonIssue.js"); // abandon issue
const removeLabels = require("./issues/removeLabels.js"); // remove labels
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const checkPullRequestComment = require("./issues/checkPullRequestComment.js"); // check if comment belongs to PR
const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team

module.exports = exports = function(payload, github) {
  // get necessary information from request body
  const action = payload.action;
  const issueLabelArray = payload.issue.labels;
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  let commenter, body, addedLabel; // initialize variables for commenter, issue (comment) body, and added label
  if (action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  } else if (action === "labeled" && github.cfg.areaLabels) {
    addedLabel = payload.label.name;
    issueAreaLabeled(github, addedLabel, issueNumber, repoName, repoOwner, issueLabelArray); // check if issue labeled with area label
    return;
  } else if (action === "closed") {
    const hasInProgressLabel = issueLabelArray.find(issueLabel => issueLabel.name === github.cfg.inProgressLabel);
    if (hasInProgressLabel) github.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: github.cfg.inProgressLabel});
    return;
  } else return;
  if (commenter === github.cfg.username) return;
  if (!body) return; // if body is empty
  const commands = body.match(new RegExp("@" + github.cfg.username + "\\s(\\w*)", "g"));
  if (!commands) return; // if there is no command
  if (body.match(/#([0-9]+)/) && github.cfg.areaLabels) checkPullRequestComment(github, body, issueNumber, repoName, repoOwner); // check if comment is from PR
  commands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    const commandName = command.split(" ")[1];
    if (github.cfg.claimCommands.includes(commandName)) claimIssue(github, commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot claim"
    else if (github.cfg.abandonCommands.includes(commandName)) abandonIssue(github, commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot abandon" or "@zulipbot claim"
    else if (github.cfg.labelCommands.includes(commandName)) {
      if (github.cfg.selfLabelingOnly && commenter !== issueCreator) return;
      const splitBody = body.split(`@${github.cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      addLabels(github, splitBody, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot label" and ensure commenter opened the issue
    } else if (github.cfg.removeCommands.includes(commandName)) {
      if (github.cfg.selfLabelingOnly && commenter !== issueCreator) return;
      const splitBody = body.split(`@${github.cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      removeLabels(github, splitBody, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot remove" and ensure commenter opened the issue
    } else if (github.cfg.joinCommands.includes(commandName) && github.cfg.areaLabels) {
      const splitBody = body.split(`@${github.cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      joinLabelTeam(github, splitBody, commenter, repoOwner, repoName, issueNumber); // check body content for "@zulipbot join"
    }
  });
};
