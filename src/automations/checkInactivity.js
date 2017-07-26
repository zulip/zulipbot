exports.run = (client) => {
  client.cfg.activeRepos.forEach(async(repo) => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    const pullRequests = await getPullRequests(client, [], repoName, repoOwner);
    await scrapeInactivePullRequests(client, pullRequests, repoName, repoOwner);
  });
};

async function getPullRequests(client, pullRequests, repoName, repoOwner) {
  let response = await client.pullRequests.getAll({owner: repoOwner, repo: repoName, sort: "updated", direction: "asc", page: 1, per_page: 100});
  pullRequests = pullRequests.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    pullRequests = pullRequests.concat(response.data);
  }
  return pullRequests;
}

async function scrapeInactivePullRequests(client, pullRequests, repoName, repoOwner) {
  let references = new Map();
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
      if (reviewedLabel && time + (client.cfg.inactivityTimeLimit * 1000) <= Date.now()) {
        client.newComment(pullRequest, pullRequest.base.repo, client.templates.get("updateWarning").replace("[author]", author));
      } else if (needsReviewLabel && time + (client.cfg.inactivityTimeLimit * 1000) <= Date.now()) {
        // newComment(repoOwner, repoName, number, needsReviewWarning.replace("[assignees], @[author]", pullRequestAssignees.join(", @").concat(`, @${author}`)));
      } else if (time + (client.cfg.inactivityTimeLimit * 1000) <= Date.now()) {
        // console.log(`Pull request #${number} in ${repoOwner}/${repoName} is inactive.\nPull request author: @${author}. Last updated: ${dateFormat(time, "UTC:dddd, mmmm dS, yyyy, h:MM TT")}.\n`);
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
  let response = await client.issues.getAll({page: 1, filter: "all", sort: "updated", labels: client.cfg.inProgressLabel, direction: "asc", per_page: 100});
  issues = issues.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    issues = issues.concat(response.data);
  }
  return issues;
}

exports.scrapeInactiveIssues = (client, references, issues, owner, name) => {
  issues.forEach((issue) => {
    const inactiveLabel = issue.labels.find(label => label.name === client.cfg.inactiveLabel);
    if (inactiveLabel) return;
    let time = Date.parse(issue.updated_at);
    const issueNumber = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    if (time < references.get(`${repoName}/${issueNumber}`)) time = references.get(`${repoName}/${issueNumber}`);
    if (repoOwner !== owner || repoName !== name || time + (client.cfg.inactivityTimeLimit * 1000) >= Date.now()) return;
    const assigneeString = issue.assignees.map(assignee => assignee.login).join(", @");
    const comment = client.templates.get("inactiveWarning").replace("[assignee]", assigneeString); // body of comment
    client.issues.getComments({owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100})
    .then((issueComments) => {
      const labelComment = issueComments.data.find((issueComment) => {
        const commentTime = Date.parse(issueComment.created_at);
        const timeLimit = Date.now() - ((client.cfg.autoAbandonTimeLimit * 1000) + (client.cfg.inactivityTimeLimit * 1000)) < commentTime && commentTime - (client.cfg.autoAbandonTimeLimit * 1000) < Date.now();
        return issueComment.body.includes(comment) && timeLimit && issueComment.user.login === client.cfg.username;
      });
      if (labelComment && time + (client.cfg.autoAbandonTimeLimit * 1000) <= Date.now()) {
        assigneeString.split(/\s*\b\s*/g).filter(a => a.match(/\b/)).forEach(a => client.commands.get("abandon").abandon(client, a.login, repoOwner, repoName, issueNumber));
        if (client.cfg.inProgressLabel) client.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel});
        client.issues.editComment({owner: repoOwner, repo: repoName, id: labelComment.id, body: client.templates.get("abandonWarning").replace("[assignee]", assigneeString)});
      } else if (!labelComment) {
        client.newComment(issue, issue.repository, comment);
      }
    });
  });
};
