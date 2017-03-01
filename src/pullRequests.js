"use strict"; // catch errors easier

const issueReferenced = require("./pullRequests/issueReferenced.js"); // create comment

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  let body; // initialize variables for pull request review (comment) body
  if (action === "submitted") { // if pull request review was submitted
    body = payload.review.body; // contents of PR review
  } else if (action === "created") { // if PR review comment was created
    body = payload.comment.body; // contents of PR review comment
  } else return;
  const pullRequestNumber = payload.pull_request.number; // number of PR
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (body && body.match(/#([0-9]+)/)) {
    issueReferenced(body, pullRequestNumber, repoName, repoOwner);
  }
};
