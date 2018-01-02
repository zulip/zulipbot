exports.run = async function(client, payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const number = pull.number;
  const repo = payload.repository;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const review = payload.review;
  const pullCfg = client.cfg.activity.pullRequests;
  const ref = client.cfg.issues.area.commitReferences;
  const wip = client.cfg.pullRequests.wip;
  const check = client.cfg.activity.check.repositories.includes(repo.full_name);
  const update = pullCfg.autoUpdate;

  if (pullCfg.reviewed.label && pullCfg.needsReview.label && check && update) {
    exports.managePRLabels(client, action, pull, review, repo);
  }

  if (action === "submitted" && pullCfg.reviewed.assignee) {
    const reviewer = review.user.login;
    client.issues.addAssigneesToIssue({
      owner: repoOwner, repo: repoName, number: number, assignees: [reviewer]
    });
  } else if (action === "labeled" && client.cfg.issues.area.labels) {
    const l = payload.label;
    const issue = await client.issues.get({
      owner: repoOwner, repo: repoName, number: number
    });
    client.automations.get("areaLabel").run(client, issue.data, repo, l);
  }

  if (!ref || pull.title.includes(wip)) return;

  if (action === "opened") {
    client.automations.get("issueReferenced").run(client, pull, repo, true);
  } else if (action === "synchronize") {
    client.automations.get("issueReferenced").run(client, pull, repo, false);
  }
};

exports.managePRLabels = async function(client, action, pull, review, repo) {
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const response = await client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  let labels = response.data.map(label => label.name);
  const needsReviewLabel = client.cfg.activity.pullRequests.needsReview.label;
  const reviewedLabel = client.cfg.activity.pullRequests.reviewed.label;
  const needsReview = labels.includes(needsReviewLabel);
  const reviewed = labels.includes(reviewedLabel);
  const a = pull.user.login;

  if (action === "opened" || action === "reopened") {
    labels.push(needsReviewLabel);
  } else if (action === "submitted" && needsReview && review.user.login !== a) {
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

  client.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: number, labels: labels
  });
};

exports.events = ["pull_request", "pull_request_review"];
