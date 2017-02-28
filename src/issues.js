"use strict";

const addLabels = require("./issues/addLabels.js");
const claimIssue = require("./issues/claimIssue.js");
const joinLabelTeam = require("./issues/joinLabelTeam.js");
const abandonIssue = require("./issues/abandonIssue.js");
const removeLabels = require("./issues/removeLabels.js");

module.exports = exports = function(payload) {
  // get necessary information from request body
  let commenter, body;
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
  if (body && body.includes("@zulipbot claim")) { // check body content for "@zulipbot claim"
    claimIssue(commenter, issueNumber, repoName, repoOwner);
  }
  if (body && body.includes("@zulipbot label") && commenter === issueCreator) { // check body content for "@zulipbot label" and ensure commenter opened the issue
    addLabels(body, issueNumber, repoName, repoOwner);
  }
  /*
  if (body && body.includes("@zulipbot join")) { // check body content for "@zulipbot join"
    joinLabelTeam(body, commenter, repoOwner, repoName, issueNumber);
  }
  */
  if (body && body.includes("@zulipbot abandon")) { // check body content for "@zulipbot abandon"
    abandonIssue(commenter, issueNumber, repoName, repoOwner);
  }
  if (body && body.includes("@zulipbot remove") && commenter === issueCreator) { // check body content for "@zulipbot remove" and ensure commenter opened the issue
    removeLabels(body, issueNumber, repoName, repoOwner);
  }
}
