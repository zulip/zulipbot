exports.run = async function(client) {
  // Create array with PRs from all active repositories
  const array = await Promise.all(
    client.cfg.activeRepos.reduce((all, repo) => {
      const repoOwner = repo.split("/")[0];
      const repoName = repo.split("/")[1];
      const func = client.pullRequests.getAll({
        owner: repoOwner, repo: repoName, per_page: 100
      });
      return all.concat(client.getAll(client, [], func));
    }, [])
  );

  // Flatten arrays of arrays with PR data
  const pullRequests = array.reduce((a, element) => {
    return a.concat(element);
  }, []);

  await scrapePullRequests(client, pullRequests);
};

async function scrapePullRequests(client, pullRequests) {
  const references = new Map();
  const ims = client.cfg.inactivityTimeLimit * 86400000;
  const iterator = pullRequests[Symbol.iterator]();

  for (let pullRequest of iterator) {
    const time = Date.parse(pullRequest.updated_at);
    const body = pullRequest.body;
    const number = pullRequest.number;
    const repoName = pullRequest.base.repo.name;
    const repoOwner = pullRequest.base.repo.owner.login;

    if (time + ims <= Date.now()) {
      checkInactivePullRequest(client, pullRequest);
    }

    const commits = await client.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number
    });
    const refIssues = commits.data.filter(c => {
      return c.commit.message.match(/#([0-9]+)/);
    }).map(c => c.commit.message);

    if (/#([0-9]+)/.test(body) || refIssues.length) {
      const commitRef = refIssues[0].match(/#([0-9]+)/)[1];
      const ref = commitRef || body.match(/#([0-9]+)/)[1];
      references.set(`${repoName}/${ref}`, time);
    }
  }

  const func = client.issues.getAll({
    filter: "all", labels: client.cfg.inProgressLabel, per_page: 100
  });
  const issues = await client.getAll(client, [], func);

  await scrapeInactiveIssues(client, references, issues);
}

async function checkInactivePullRequest(client, pullRequest) {
  const author = pullRequest.user.login;
  const repoName = pullRequest.base.repo.name;
  const repoOwner = pullRequest.base.repo.owner.login;
  const number = pullRequest.number;

  const labels = await client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });
  const inactiveLabel = labels.data.find(l => {
    return l.name === client.cfg.inactiveLabel;
  });
  const reviewedLabel = labels.data.find(l => {
    return l.name === client.cfg.reviewedLabel;
  });

  if (inactiveLabel || !reviewedLabel) return;

  const comment = client.templates.get("updateWarning")
    .replace("[author]", author)
    .replace("[days]", client.cfg.inactivityTimeLimit);

  const comments = await client.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const com = comments.data.slice(-1).pop();

  // Use end of line comments to check if comment is from template
  const lastComment = com.body.endsWith("<!-- updateWarning -->");
  const fromClient = com.user.login === client.cfg.username;

  if (reviewedLabel && !(lastComment && fromClient)) {
    client.newComment(pullRequest, pullRequest.base.repo, comment);
  }
}

async function scrapeInactiveIssues(client, references, issues) {
  const ms = client.cfg.autoAbandonTimeLimit * 86400000;
  const ims = client.cfg.inactivityTimeLimit * 86400000;
  const iterator = issues[Symbol.iterator]();

  for (let issue of iterator) {
    const inactiveLabel = issue.labels.find(label => {
      return label.name === client.cfg.inactiveLabel;
    });
    if (inactiveLabel) return;

    let time = Date.parse(issue.updated_at);
    const issueNumber = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;

    if (time < references.get(`${repoName}/${issueNumber}`)) {
      time = references.get(`${repoName}/${issueNumber}`);
    }

    const active = client.cfg.activeRepos.includes(`${repoOwner}/${repoName}`);

    if (time + ms >= Date.now() || !active) return;

    const aString = issue.assignees.map(assignee => assignee.login).join(", @");

    if (!aString) {
      const comment = "**ERROR:** This active issue has no assignee.";
      return client.newComment(issue, issue.repository, comment);
    }

    const c = client.templates.get("inactiveWarning")
      .replace("[assignee]", aString)
      .replace("[inactive]", client.cfg.inactivityTimeLimit)
      .replace("[abandon]", client.cfg.autoAbandonTimeLimit)
      .replace("[username]", client.cfg.username);

    const issueComments = await client.issues.getComments({
      owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
    });
    const com = issueComments.data.slice(-1).pop();

    // Use end of line comments to check if comment is from template
    const labelComment = com.body.endsWith("<!-- inactiveWarning -->");
    const fromClient = com.user.login === client.cfg.username;

    if (labelComment && fromClient) {
      const assignees = JSON.stringify({
        assignees: aString.split(", @")
      });

      client.issues.removeAssigneesFromIssue({
        owner: repoOwner, repo: repoName, number: issueNumber, body: assignees
      });

      const warning = client.templates.get("abandonWarning")
        .replace("[assignee]", aString)
        .replace("[total]", (ms + ims) / 86400000)
        .replace("[username]", client.cfg.username);

      client.issues.editComment({
        owner: repoOwner, repo: repoName, id: com.id, body: warning
      });
    } else if (!(labelComment && fromClient) && time + ims <= Date.now()) {
      client.newComment(issue, issue.repository, c);
    }
  }
}
