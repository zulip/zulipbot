"use strict"; // catch errors easier

const addLabels = require("./issues/addLabels.js"); // add labels
const claimIssue = require("./issues/claimIssue.js"); // claim issue
const abandonIssue = require("./issues/abandonIssue.js"); // abandon issue
const removeLabels = require("./issues/removeLabels.js"); // remove labels
// const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team (disabled)

module.exports = exports = function(payload) {
  // get necessary information from request body
  let commenter, body; // initialize variables for commenter and issue (comment) body
  if (payload.action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (payload.action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  }
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (body && body.includes("@zulipbot claim")) {
    claimIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot claim"
  }
  if (body && body.includes("@zulipbot label") && commenter === issueCreator) {
    addLabels(body, issueNumber, repoName, repoOwner); // check body content for "@zulipbot label" and ensure commenter opened the issue
  }
  if (body && body.includes("@zulipbot abandon")) {
    abandonIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot abandon"
  }
  if (body && body.includes("@zulipbot remove") && commenter === issueCreator) {
    removeLabels(body, issueNumber, repoName, repoOwner); // check body content for "@zulipbot remove" and ensure commenter opened the issue
  }
  /*
  if (body && body.includes("@zulipbot join")) { // check body content for "@zulipbot join" (disabled)
    joinLabelTeam(body, commenter, repoOwner, repoName, issueNumber);
  }
  */
};
