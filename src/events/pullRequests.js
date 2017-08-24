exports.run = (client, payload) => {
  const action = payload.action;
  const pullRequest = payload.pull_request;
  const number = pullRequest.number;
  const repository = payload.repository;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const review = payload.review;
  if (client.cfg.reviewedLabel && client.cfg.needsReviewLabel) {
    exports.managePRLabels(client, action, pullRequest, review, repository);
  }
  if (action === "submitted" && client.cfg.pullRequestsAssignee) {
    client.issues.addAssigneesToIssue({
      owner: repoOwner, repo: repoName, number: number, assignees: [review.user.login]
    });
  } else if (action === "labeled" && client.cfg.areaLabels) {
    client.issues.get({
      owner: repoOwner, repo: repoName, number: number
    }).then((response) => {
      client.automations.get("areaLabel").run(client, response.data, repository, payload.label);
    });
  } else if (!client.cfg.areaLabels || !client.cfg.commitReferenceEnabled) {
    return;
  }
  if (action === "opened") {
    client.automations.get("issueReferenced").run(client, pullRequest, repository, true);
  } else if (action === "synchronize") {
    client.automations.get("issueReferenced").run(client, pullRequest, repository, false);
    if (client.cfg.checkMergeConflicts) {
      client.automations.get("checkMergeConflicts").check(client, number, repoName, repoOwner);
    }
  }
};

exports.managePRLabels = (client, action, pullRequest, review, repository) => {
  const number = pullRequest.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  }).then((response) => {
    let labels = response.data.map(label => label.name);
    const needsReview = labels.includes(client.cfg.needsReviewLabel);
    const reviewed = labels.includes(client.cfg.reviewedLabel);
    if (action === "opened" || action === "reopened") {
      labels.push(client.cfg.needsReviewLabel);
    } else if (action === "submitted" && needsReview && review.user.login !== pullRequest.user.login) {
      labels[labels.indexOf(client.cfg.needsReviewLabel)] = client.cfg.reviewedLabel;
    } else if (action === "synchronize" && reviewed) {
      labels[labels.indexOf(client.cfg.reviewedLabel)] = client.cfg.needsReviewLabel;
    } else if (action === "closed" && reviewed) {
      labels.splice(labels.indexOf(client.cfg.reviewedLabel), 1);
    } else if (action === "closed" && needsReview) {
      labels.splice(labels.indexOf(client.cfg.needsReviewLabel), 1);
    } else {
      return;
    }
    client.issues.replaceAllLabels({
      owner: repoOwner, repo: repoName, number: number, labels: labels
    });
  });
};

exports.events = ["pull_request", "pull_request_review"];
