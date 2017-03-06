"use strict"; // catch errors easier

const github = require("./github.js"); // GitHub wrapper initialization
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const issueReferenced = require("./pullRequests/issueReferenced.js"); // create comment

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  let body, addedLabel; // initialize variables for pull request review (comment) body and added label
  if (action === "opened") { // if pull request was opened
    body = payload.pull_request.body; // contents of PR body
  } else if (action === "submitted") { // if pull request review was submitted
    body = payload.review.body; // contents of PR review
  } else if (action === "created") { // if PR review comment was created
    body = payload.comment.body; // contents of PR review comment
  } else if (action === "labeled") {
    addedLabel = payload.label.name;
  } else return;
  const pullRequestNumber = payload.pull_request.number; // number of PR
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (body && body.match(/#([0-9]+)/)) {
    issueReferenced(body, pullRequestNumber, repoName, repoOwner);
  }
  if (addedLabel) {
    github.issues.getIssueLabels({
      owner: repoOwner,
      repo: repoName,
      number: pullRequestNumber
    }).then((response) => {
      const issueLabelArray = response.data;
      issueAreaLabeled(addedLabel, pullRequestNumber, repoName, repoOwner, issueLabelArray);
    });
  }
};
