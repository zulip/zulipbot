exports.label = async function(payload) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.pull_request.number;

  const response = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  let labels = response.data.map(label => label.name);
  const autoUpdate = this.cfg.activity.pullRequests.autoUpdate;

  if (autoUpdate) {
    const author = payload.pull_request.user.login;
    const reviewer = payload.review ? payload.review.user.login : null;
    labels = review.apply(this, [labels, payload.action, author, reviewer]);
  }

  this.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: number, labels: labels
  });
};

function review(labels, action, author, reviewer) {
  const needsReviewLabel = this.cfg.activity.pullRequests.needsReview.label;
  const reviewedLabel = this.cfg.activity.pullRequests.reviewed.label;
  const needsReview = labels.includes(needsReviewLabel);
  const reviewed = labels.includes(reviewedLabel);

  if (action === "opened" || action === "reopened") {
    labels.push(needsReviewLabel);
  } else if (action === "submitted" && needsReview && reviewer !== author) {
    labels[labels.indexOf(needsReviewLabel)] = reviewedLabel;
  } else if (action === "synchronize" && reviewed) {
    labels[labels.indexOf(reviewedLabel)] = needsReviewLabel;
  } else if (action === "closed" && reviewed) {
    labels.splice(labels.indexOf(reviewedLabel), 1);
  } else if (action === "closed" && needsReview) {
    labels.splice(labels.indexOf(needsReviewLabel), 1);
  }

  return labels;
}

exports.assign = function(payload) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const reviewer = payload.reviewer.user.login;
  const number = payload.pull_request.number;

  this.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [reviewer]
  });
};
