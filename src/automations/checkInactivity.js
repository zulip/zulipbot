exports.run = async function(client) {
  // Create array with PRs from all active repositories
  const repos = client.cfg.activity.check.repositories;
  const pages = repos.map(async repo => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    const firstPage = await client.pullRequests.getAll({
      owner: repoOwner, repo: repoName, per_page: 100
    });
    return client.getAll(firstPage);
  });

  const array = await Promise.all(pages);

  // Flatten arrays of arrays with PR data
  const pullRequests = array.reduce((a, element) => {
    return a.concat(element);
  }, []);

  await scrapePullRequests(client, pullRequests);
};

async function scrapePullRequests(client, pullRequests) {
  const references = new Map();
  const ims = client.cfg.activity.check.reminder * 86400000;
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
      return client.findKeywords(c.commit.message);
    }).map(c => c.commit.message);
    const bodRef = client.findKeywords(body);

    if (bodRef || refIssues.length) {
      const com = refIssues[0];
      const ref = com ? com.match(/#([0-9]+)/)[1] : body.match(/#([0-9]+)/)[1];
      references.set(`${repoName}/${ref}`, time);
    }
  }

  const firstPage = await client.issues.getAll({
    filter: "all", per_page: 100,
    labels: client.cfg.activity.issues.inProgress
  });
  const issues = await client.getAll(firstPage);

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
    return l.name === client.cfg.activity.inactive;
  });
  const reviewedLabel = labels.data.find(l => {
    return l.name === client.cfg.activity.pullRequests.reviewed.label;
  });

  if (inactiveLabel || !reviewedLabel) return;

  const comment = client.templates.get("updateWarning")
    .replace(new RegExp("{author}", "g"), author)
    .replace(new RegExp("{days}", "g"), client.cfg.activity.check.reminder);

  const comments = await client.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const com = comments.data.slice(-1).pop();

  // Use end of line comments to check if comment is from template
  const lastComment = com ? com.body.endsWith("<!-- updateWarning -->") : null;
  const fromClient = com ? com.user.login === client.cfg.auth.username : null;

  if (reviewedLabel && !(lastComment && fromClient)) {
    client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }
}

async function scrapeInactiveIssues(client, references, issues) {
  const ms = client.cfg.activity.check.limit * 86400000;
  const ims = client.cfg.activity.check.reminder * 86400000;
  const iterator = issues[Symbol.iterator]();

  for (let issue of iterator) {
    const inactiveLabel = issue.labels.find(label => {
      return label.name === client.cfg.activity.inactive;
    });
    if (inactiveLabel) continue;

    let time = Date.parse(issue.updated_at);
    const number = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    const issueTag = `${repoName}/${number}`;
    const repoTag = issue.repository.full_name;

    if (time < references.get(issueTag)) time = references.get(issueTag);

    const active = client.cfg.activity.check.repositories.includes(repoTag);

    if (time + ms >= Date.now() || !active) continue;

    const aString = issue.assignees.map(assignee => assignee.login).join(", @");

    if (!aString) {
      const comment = "**ERROR:** This active issue has no assignee.";
      return client.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: comment
      });
    }

    const c = client.templates.get("inactiveWarning")
      .replace(new RegExp("{assignee}", "g"), aString)
      .replace(new RegExp("{remind}", "g"), client.cfg.activity.check.reminder)
      .replace(new RegExp("{abandon}", "g"), client.cfg.activity.check.limit)
      .replace(new RegExp("{username}", "g"), client.cfg.auth.username);

    const issueComments = await client.issues.getComments({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    });
    const com = issueComments.data.slice(-1).pop();

    // Use end of line comments to check if comment is from template
    const warning = com ? com.body.endsWith("<!-- inactiveWarning -->") : null;
    const fromClient = com ? com.user.login === client.cfg.auth.username : null;

    if (warning && fromClient) {
      const assignees = JSON.stringify({
        assignees: aString.split(", @")
      });

      client.issues.removeAssigneesFromIssue({
        owner: repoOwner, repo: repoName, number: number, body: assignees
      });

      const warning = client.templates.get("abandonWarning")
        .replace(new RegExp("{assignee}", "g"), aString)
        .replace(new RegExp("{total}", "g"), (ms + ims) / 86400000)
        .replace(new RegExp("{username}", "g"), client.cfg.auth.username);

      client.issues.editComment({
        owner: repoOwner, repo: repoName, id: com.id, body: warning
      });
    } else if (!(warning && fromClient) && time + ims <= Date.now()) {
      client.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: c
      });
    }
  }
}
