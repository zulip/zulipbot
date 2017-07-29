exports.run = (client) => {
  client.cfg.activeRepos.forEach(async(repo) => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    const pullRequests = await getPullRequests(client, [], repoName, repoOwner);
    await scrapeInactivePullRequests(client, pullRequests, repoName, repoOwner);
  });
};

async function getPullRequests(client, pullRequests, repoName, repoOwner) {
  let response = await client.pullRequests.getAll({
    owner: repoOwner, repo: repoName, per_page: 100
  });
  pullRequests = pullRequests.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    pullRequests = pullRequests.concat(response.data);
  }
  return pullRequests;
}

async function scrapeInactivePullRequests(client, pullRequests, repoName, repoOwner) {
  const references = new Map();
  const ims = client.cfg.inactivityTimeLimit * 1000;
  pullRequests.forEach((pullRequest) => {
    const body = pullRequest.body;
    const time = Date.parse(pullRequest.updated_at);
    const number = pullRequest.number;
    const author = pullRequest.user.login;
    client.issues.getIssueLabels({owner: repoOwner, repo: repoName, number: number})
    .then((response) => {
      const inactiveLabel = response.data.find(l => l.name === client.cfg.inactiveLabel);
      if (inactiveLabel) return;
      const reviewedLabel = response.data.find(l => l.name === client.cfg.reviewedLabel);
      const needsReviewLabel = response.data.find(l => l.name === client.cfg.needsReviewLabel);
      if (reviewedLabel && time + ims <= Date.now()) {
        const comment = client.templates.get("updateWarning").replace("[author]", author);
        client.newComment(pullRequest, pullRequest.base.repo, comment);
      } else if (needsReviewLabel && time + ims <= Date.now()) {
        // notify project maintainers
      } else if (time + (client.cfg.inactivityTimeLimit * 1000) <= Date.now()) {
        // inactive PR (status unknown)
      }
    });
    if (!body.match(/#([0-9]+)/)) return;
    const issueNumber = body.match(/#([0-9]+)/)[1];
    references.set(`${repoName}/${issueNumber}`, time);
  });
  const issues = await getIssues(client, []);
  exports.scrapeInactiveIssues(client, references, issues, repoOwner, repoName);
}

async function getIssues(client, issues) {
  let response = await client.issues.getAll({
    filter: "all", labels: client.cfg.inProgressLabel, per_page: 100
  });
  issues = issues.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    issues = issues.concat(response.data);
  }
  return issues;
}

exports.scrapeInactiveIssues = (client, references, issues, owner, name) => {
  const ms = client.cfg.autoAbandonTimeLimit * 1000;
  const ims = client.cfg.inactivityTimeLimit * 1000;
  issues.forEach((issue) => {
    const inactiveLabel = issue.labels.find(label => label.name === client.cfg.inactiveLabel);
    if (inactiveLabel) return;
    let time = Date.parse(issue.updated_at);
    const issueNumber = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    if (time < references.get(`${repoName}/${issueNumber}`)) {
      time = references.get(`${repoName}/${issueNumber}`);
    }
    if (repoOwner !== owner || repoName !== name || time + ims >= Date.now()) {
      return;
    }
    const assigneeString = issue.assignees.map(assignee => assignee.login).join(", @");
    const comment = client.templates.get("inactiveWarning").replace("[assignee]", assigneeString);
    client.issues.getComments({
      owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
    }).then((issueComments) => {
      const labelComment = issueComments.data.find((issueComment) => {
        const commentTime = Date.parse(issueComment.created_at);
        const timeLimit = Date.now() - (ms + ims) < commentTime && commentTime - ms < Date.now();
        return issueComment.body.includes(comment) && timeLimit && issueComment.user.login === client.cfg.username;
      });
      if (labelComment && time + (client.cfg.autoAbandonTimeLimit * 1000) <= Date.now()) {
        assigneeString.split(/\s*\b\s*/g).filter(a => a.match(/\b/)).forEach((a) => {
          client.commands.get("abandon").abandon(client, a.login, repoOwner, repoName, issueNumber);
        });
        if (client.cfg.inProgressLabel) {
          client.issues.removeLabel({
            owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel
          });
        }
        const warning = client.templates.get("abandonWarning").replace("[assignee]", assigneeString);
        client.issues.editComment({
          owner: repoOwner, repo: repoName, id: labelComment.id, body: warning
        });
      } else if (!labelComment) {
        client.newComment(issue, issue.repository, comment);
      }
    });
  });
};
