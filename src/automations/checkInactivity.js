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
  const ims = client.cfg.inactivityTimeLimit * 86400000;
  pullRequests.forEach(async(pullRequest, index) => {
    setTimeout(async() => {
      const time = Date.parse(pullRequest.updated_at);
      const body = pullRequest.body;
      const number = pullRequest.number;
      const author = pullRequest.user.login;
      if (time + ims <= Date.now()) {
        const labels = await client.issues.getIssueLabels({
          owner: repoOwner, repo: repoName, number: number
        });
        const inactiveLabel = labels.data.find(l => l.name === client.cfg.inactiveLabel);
        const reviewedLabel = labels.data.find(l => l.name === client.cfg.reviewedLabel);
        if (inactiveLabel || !reviewedLabel) return;
        const comment = client.templates.get("updateWarning").replace("[author]", author);
        const comments = await client.issues.getComments({
          owner: repoOwner, repo: repoName, number: number, per_page: 100
        });
        const issueComment = comments.data.slice(-1).pop();
        const lastComment = issueComment.body.includes(comment) && issueComment.user.login === client.cfg.username;
        if (reviewedLabel && !lastComment) {
          client.newComment(pullRequest, pullRequest.base.repo, comment);
        }
      }
      if (body.match(/#([0-9]+)/)) return references.set(`${repoName}/${body.match(/#([0-9]+)/)[1]}`, time);
      const commits = await client.pullRequests.getCommits({
        owner: repoOwner, repo: repoName, number: number
      });
      const refIssues = commits.data.find((c) => {
        return c.commit.message.match(/#([0-9]+)/);
      });
      if (refIssues) references.set(`${repoName}/${refIssues.commit.message.match(/#([0-9]+)/)[1]}`, time);
    }, index * 500);
  });
  const issues = await getIssues(client, []);
  await scrapeInactiveIssues(client, references, issues, repoOwner, repoName);
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

async function scrapeInactiveIssues(client, references, issues, owner, name) {
  const ms = client.cfg.autoAbandonTimeLimit * 86400000;
  const ims = client.cfg.inactivityTimeLimit * 86400000;
  issues.forEach(async(issue, index) => {
    setTimeout(async() => {
      const inactiveLabel = issue.labels.find(label => label.name === client.cfg.inactiveLabel);
      if (inactiveLabel) return;
      let time = Date.parse(issue.updated_at);
      const issueNumber = issue.number;
      const repoName = issue.repository.name;
      const repoOwner = issue.repository.owner.login;
      if (time < references.get(`${repoName}/${issueNumber}`)) {
        time = references.get(`${repoName}/${issueNumber}`);
      }
      if (repoOwner !== owner || repoName !== name || time + ms >= Date.now()) {
        return;
      }
      const assigneeString = issue.assignees.map(assignee => assignee.login).join(", @");
      const comment = client.templates.get("inactiveWarning")
      .replace("[assignee]", assigneeString)
      .replace("[inactive]", client.cfg.inactivityTimeLimit)
      .replace("[abandon]", client.cfg.autoAbandonTimeLimit)
      .replace("[username]", client.cfg.username);
      const issueComments = await client.issues.getComments({
        owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
      });
      const issueComment = issueComments.data.slice(-1).pop();
      const labelComment = issueComment.body.includes(comment) && issueComment.user.login === client.cfg.username;
      if (labelComment && time + ms <= Date.now()) {
        assigneeString.split(/\s*\b\s*/g).filter(a => a.match(/\b/)).forEach((a) => {
          client.commands.get("abandon").abandon(client, a.login, repoOwner, repoName, issueNumber);
        });
        if (client.cfg.inProgressLabel) {
          client.issues.removeLabel({
            owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel
          });
        }
        const warning = client.templates.get("abandonWarning")
        .replace("[assignee]", assigneeString)
        .replace("[total]", client.cfg.autoAbandonTimeLimit + client.cfg.inactivityTimeLimit)
        .replace("[username]", client.cfg.username);
        client.issues.editComment({
          owner: repoOwner, repo: repoName, id: issueComment.id, body: warning
        });
      } else if (!labelComment && time + ims <= Date.now()) {
        client.newComment(issue, issue.repository, comment);
      }
    }, index * 500);
  });
}
