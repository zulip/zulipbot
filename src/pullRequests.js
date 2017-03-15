"use strict"; // catch errors easier

const github = require("./github.js"); // GitHub wrapper initialization
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const issueReferenced = require("./pullRequests/issueReferenced.js"); // create comment
const commitReference = require("./pullRequests/commitReference.js"); // create comment

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  let body, addedLabel; // initialize variables for pull request review (comment) body and added label
  const pullRequestNumber = payload.pull_request.number; // number of PR
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (action === "opened") { // if pull request was opened
    body = payload.pull_request.body; // contents of PR body
    commitReference(body, pullRequestNumber, repoName, repoOwner);
  } else if (action === "submitted") { // if pull request review was submitted
    body = payload.review.body; // contents of PR review
  } else if (action === "created") { // if PR review comment was created
    body = payload.comment.body; // contents of PR review comment
  } else if (action === "synchronize") { // when PR is synchronized (commits modified)
    commitReference(body, pullRequestNumber, repoName, repoOwner); // check if edited commits reference an issue
    return;
  } else if (action === "labeled") {
    addedLabel = payload.label.name;
    github.issues.getIssueLabels({
      owner: repoOwner,
      repo: repoName,
      number: pullRequestNumber
    }).then((response) => {
      const issueLabelArray = response.data;
      issueAreaLabeled(addedLabel, pullRequestNumber, repoName, repoOwner, issueLabelArray);
      return;
    });
  } else return;
  if (body.match(/#([0-9]+)/)) issueReferenced(body, pullRequestNumber, repoName, repoOwner);
};
