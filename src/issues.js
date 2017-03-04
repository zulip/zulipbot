"use strict"; // catch errors easier

const addLabels = require("./issues/addLabels.js"); // add labels
const claimIssue = require("./issues/claimIssue.js"); // claim issue
const abandonIssue = require("./issues/abandonIssue.js"); // abandon issue
const removeLabels = require("./issues/removeLabels.js"); // remove labels
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const checkPullRequestComment = require("./issues/checkPullRequestComment.js"); // check if comment belongs to PR
// const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team (disabled)

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
  if (commenter === "zulipbot") return;
  if (body && body.includes("@zulipbot claim")) {
    claimIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot claim"
  }
  if (body && body.includes("@zulipbot label") && commenter === issueCreator) {
    addLabels(body, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot label" and ensure commenter opened the issue
  }
  if (body && body.includes("@zulipbot abandon")) {
    abandonIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot abandon"
  }
  if (body && body.includes("@zulipbot remove") && commenter === issueCreator) {
    removeLabels(body, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot remove" and ensure commenter opened the issue
  }
  if (addedLabel) {
    issueAreaLabeled(addedLabel, issueNumber, repoName, repoOwner, issueLabelArray);
  }
  if (body && body.match(/#([0-9]+)/)) {
    checkPullRequestComment(body, issueNumber, repoName, repoOwner);
  }
  /*
  if (body && body.includes("@zulipbot join")) { // check body content for "@zulipbot join" (disabled)
    joinLabelTeam(body, commenter, repoOwner, repoName, issueNumber);
  }
  */
};
