const commitReference = require("./pullRequests/commitReference.js");

exports.run = (client, payload) => {
  const action = payload.action;
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
      if (client.cfg.areaLabels && client.cfg.commitReferenceEnabled) commitReference(client, payload.pull_request.body, pullRequestNumber, repoName, repoOwner);
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel) client.issues.addLabels({owner: repoOwner, repo: repoName, number: pullRequestNumber, labels: [client.cfg.needsReviewLabel]}).catch(console.error); // add labels
    } else if (action === "submitted") { // if pull request review was submitted
      const reviewer = payload.review.user.login; // reviewer username
      const author = payload.pull_request.user.login; // PR opener
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel && labels.indexOf(client.cfg.needsReviewLabel) !== -1 && reviewer !== author) {
        labels[labels.indexOf(client.cfg.needsReviewLabel)] = client.cfg.reviewedLabel;
        replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels);
        if (client.cfg.pullRequestsAssignee) client.issues.addAssigneesToIssue({owner: repoOwner, repo: repoName, number: pullRequestNumber, assignees: [reviewer]}).catch(console.error);
      }
    } else if (action === "synchronize") { // when PR is synchronized (commits modified)
      if (client.cfg.areaLabels && client.cfg.commitReferenceEnabled) commitReference(client, payload.pull_request.body, pullRequestNumber, repoName, repoOwner); // check if edited commits reference an issue
      if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel && labels.indexOf(client.cfg.reviewedLabel) !== -1) {
        labels[labels.indexOf(client.cfg.reviewedLabel)] = client.cfg.needsReviewLabel;
        replaceLabels(client, repoOwner, repoName, pullRequestNumber, labels);
      }
    } else if (action === "labeled" && client.cfg.areaLabels) {
      client.issues.get({owner: repoOwner, repo: repoName, number: pullRequestNumber})
      .then((response) => {
        require("./issues/areaLabel.js").run(client, response.data, payload.repository, payload.label);
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
    }
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
