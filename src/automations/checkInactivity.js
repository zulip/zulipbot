let references = new Map();

exports.run = (client) => {
  client.cfg.activeRepos.forEach((repo) => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    let pullRequests = [];
    exports.getPullRequests(client, pullRequests, repoName, repoOwner, 1);
  });
};

exports.getPullRequests = (client, pullRequests, repoName, repoOwner, pageCount) => {
  client.pullRequests.getAll({owner: repoOwner, repo: repoName, sort: "updated", direction: "asc", page: pageCount, per_page: 100})
  .then((res) => {
    pullRequests = pullRequests.concat(res.data);
    if (client.hasNextPage(res)) {
      exports.getPullRequests(client, pullRequests, repoName, repoOwner, pageCount + 1);
    } else {
      exports.scrapeInactivePullRequests(client, pullRequests, repoName, repoOwner);
    }
  });
};

exports.scrapeInactivePullRequests = (client, pullRequests, repoName, repoOwner) => {
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
  let issues = [];
  exports.getIssues(client, issues, references, repoOwner, repoName, 1);
};

exports.getIssues = (client, issues, references, repoOwner, repoName, pageCount) => {
  client.issues.getAll({page: pageCount, filter: "all", sort: "updated", labels: client.cfg.inProgressLabel, direction: "asc", per_page: 100})
  .then((res) => {
    issues = issues.concat(res.data);
    if (client.hasNextPage(res)) {
      exports.getIssues(client, issues, references, repoOwner, repoName, pageCount + 1);
    } else {
      exports.scrapeInactiveIssues(client, references, issues, repoOwner, repoName);
    }
  });
};

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
