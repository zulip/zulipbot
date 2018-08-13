const _ = require("lodash");

exports.label = async function(payload) {
  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.pull_request.number;
  const action = payload.action;

  const response = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  let labels = response.data.map(label => label.name);
  const oldLabels = labels;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const sizeLabels = this.cfg.pulls.status.size.labels;

  if (autoUpdate) {
    const author = payload.pull_request.user.login;
    const reviewer = payload.review ? payload.review.user.login : null;
    labels = review.apply(this, [labels, action, author, reviewer]);
  }

  if (sizeLabels && ["opened", "synchronize"].includes(action)) {
    const repo = payload.repository;
    labels = await size.apply(this, [sizeLabels, labels, number, repo]);
  }

  if (!_.isEqual(oldLabels.sort(), labels.sort())) {
    await this.issues.replaceAllLabels({
      owner: repoOwner, repo: repoName, number: number, labels: labels
    });
  }

  return new Promise(resolve => resolve());
};

function review(labels, action, author, reviewer) {
  const needsReviewLabel = this.cfg.activity.pulls.needsReview.label;
  const reviewedLabel = this.cfg.activity.pulls.reviewed.label;
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

async function size(sizeLabels, labels, number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const pullLabels = labels.filter(label => !sizeLabels.has(label));

  const files = await this.util.getAllPages("pullRequests.getFiles", {
    owner: repoOwner, repo: repoName, number: number
  });

  const changes = files.filter(file => {
    return !this.cfg.pulls.status.size.exclude.includes(file.filename);
  }).reduce((sum, file) => sum + file.changes, 0);

  let label = sizeLabels.keys().next().value;

  sizeLabels.forEach((size, name) => {
    if (changes > size) label = name;
  });

  pullLabels.push(label);

  if (pullLabels.sort() === labels.sort()) {
    return new Promise(resolve => resolve(labels));
  }

  return new Promise(resolve => resolve(pullLabels));
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
