exports.review = async function(payload) {
  const review = payload.review;
  const action = payload.action;
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const pull = payload.pull_request;
  const number = pull.number;

  const response = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  let labels = response.data.map(label => label.name);
  const needsReviewLabel = this.cfg.activity.pullRequests.needsReview.label;
  const reviewedLabel = this.cfg.activity.pullRequests.reviewed.label;
  const needsReview = labels.includes(needsReviewLabel);
  const reviewed = labels.includes(reviewedLabel);
  const author = pull.user.login;
  const reviewer = review.user.login;

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
  } else {
    return;
  }

  this.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: number, labels: labels
  });
};

exports.assign = function(payload) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const reviewer = payload.reviewer.user.login;
  const number = payload.pull_request.number;

  this.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [reviewer]
  });
};
