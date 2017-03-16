"use strict"; // catch errors easier

const github = require("./github.js"); // GitHub wrapper initialization
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const issueReferenced = require("./pullRequests/issueReferenced.js"); // pull request references an issue
const commitReference = require("./pullRequests/commitReference.js"); // create comment

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  let body, addedLabel; // initialize variables for pull request review (comment) body and added label
  const pullRequestNumber = payload.pull_request.number; // number of PR
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  let labels = [];
  github.issues.getIssueLabels({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((response) => {
    response.data.forEach(label => labels.push(label.name));
    if (action === "opened") { // if pull request was opened
      body = payload.pull_request.body; // contents of PR body
      commitReference(body, pullRequestNumber, repoName, repoOwner);
      github.issues.addLabels({ // add labels
        owner: repoOwner,
        repo: repoName,
        number: pullRequestNumber,
        labels: ["needs review"]
      })
      .catch(console.error);
    } else if (action === "submitted") { // if pull request review was submitted
      body = payload.review.body; // contents of PR review
      if (labels.indexOf("needs review") !== -1) labels[labels.indexOf("needs review")] = "reviewed";
      replaceLabels(repoOwner, repoName, pullRequestNumber, labels);
    } else if (action === "created") { // if PR review comment was created
      body = payload.comment.body; // contents of PR review comment
      if (labels.indexOf("needs review") !== -1) labels[labels.indexOf("needs review")] = "reviewed";
      replaceLabels(repoOwner, repoName, pullRequestNumber, labels);
    } else if (action === "synchronize") { // when PR is synchronized (commits modified)
      commitReference(body, pullRequestNumber, repoName, repoOwner); // check if edited commits reference an issue
      if (labels.indexOf("reviewed") !== -1) labels[labels.indexOf("reviewed")] = "needs review";
      replaceLabels(repoOwner, repoName, pullRequestNumber, labels);
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
    if (body && body.match(/#([0-9]+)/) && action !== "opened") issueReferenced(body, pullRequestNumber, repoName, repoOwner);
  });
};

function replaceLabels(repoOwner, repoName, pullRequestNumber, labels) {
  github.issues.replaceAllLabels({ // replace labels without removed labels
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber,
    labels: labels
  })
  .catch(console.error);
}
