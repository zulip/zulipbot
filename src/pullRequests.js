"use strict"; // catch errors easier

const issueAreaLabeled = require("./issues/areaLabel.js"); // issue labeled with area label
const issueReferenced = require("./pullRequests/issueReferenced.js"); // pull request references an issue
const commitReference = require("./pullRequests/commitReference.js"); // create comment

module.exports = exports = (payload, client) => {
  // get necessary information from request body
  const action = payload.action;
  let body, addedLabel; // initialize variables for pull request review (comment) body and added label
  const pullRequestNumber = payload.pull_request.number; // number of PR
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  let labels = [];
  client.issues.getIssueLabels({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((response) => {
    response.data.forEach(label => labels.push(label.name));
    if (action === "opened") { // if pull request was opened
      body = payload.pull_request.body; // contents of PR body
      if (client.cfg.areaLabels && client.cfg.commitReferenceEnabled) commitReference(client, body, pullRequestNumber, repoName, repoOwner);
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel) client.issues.addLabels({owner: repoOwner, repo: repoName, number: pullRequestNumber, labels: [client.cfg.needsReviewLabel]}).catch(console.error); // add labels
    } else if (action === "submitted") { // if pull request review was submitted
      body = payload.review.body; // contents of PR review
      const reviewer = payload.review.user.login; // reviewer username
      const author = payload.pull_request.user.login; // PR opener
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel && labels.indexOf(client.cfg.needsReviewLabel) !== -1 && reviewer !== author) {
        labels[labels.indexOf(client.cfg.needsReviewLabel)] = client.cfg.reviewedLabel;
        replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels);
        if (client.cfg.pullRequestsAssignee) client.issues.addAssigneesToIssue({owner: repoOwner, repo: repoName, number: pullRequestNumber, assignees: [reviewer]}).catch(console.error);
      }
    } else if (action === "created") { // if PR review comment was created
      body = payload.comment.body; // contents of PR review comment
    } else if (action === "synchronize") { // when PR is synchronized (commits modified)
      if (client.cfg.areaLabels && client.cfg.commitReferenceEnabled) commitReference(client, body, pullRequestNumber, repoName, repoOwner); // check if edited commits reference an issue
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel && labels.indexOf(client.cfg.reviewedLabel) !== -1) {
        labels[labels.indexOf(client.cfg.reviewedLabel)] = client.cfg.needsReviewLabel;
        replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels);
      }
      return;
    } else if (action === "labeled") {
      addedLabel = payload.label.name;
      client.issues.getIssueLabels({
        owner: repoOwner,
        repo: repoName,
        number: pullRequestNumber
      }).then((response) => {
        const issueLabelArray = response.data;
        if (client.cfg.areaLabels) return issueAreaLabeled(client, addedLabel, pullRequestNumber, repoName, repoOwner, issueLabelArray);
      });
    } else if (action === "closed") {
      if (!client.cfg.reviewedLabel || !client.cfg.needsReviewLabel) return;
      const reviewedLabel = labels.find((label) => {
        return label === client.cfg.reviewedLabel;
      });
      const needsReviewLabel = labels.find((label) => {
        return label === client.cfg.needsReviewLabel;
      });
      if (reviewedLabel) {
        labels.splice(labels.indexOf(reviewedLabel), 1);
      } else if (needsReviewLabel) {
        labels.splice(labels.indexOf(needsReviewLabel), 1);
      } else return;
      replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels);
    } else return;
    if (body && body.match(/#([0-9]+)/) && action !== "opened" && client.cfg.areaLabels) issueReferenced(client, body, pullRequestNumber, repoName, repoOwner);
  });
};

function replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels) {
  client.issues.replaceAllLabels({ // replace labels without removed labels
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber,
    labels: labels
  })
  .catch(console.error);
}
