exports.run = async function() {
  // Create array with PRs from all active repositories
  const repos = this.cfg.activity.check.repositories;
  const pages = repos.map(async repo => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    const firstPage = await this.pullRequests.getAll({
      owner: repoOwner, repo: repoName, per_page: 100
    });
    return this.getAll(firstPage);
  });

  const array = await Promise.all(pages);

  // Flatten arrays of arrays with PR data
  const pullRequests = array.reduce((a, element) => {
    return a.concat(element);
  }, []);

  await scrapePullRequests.call(this, pullRequests);
};

async function scrapePullRequests(pullRequests) {
  const references = new Map();
  const ims = this.cfg.activity.check.reminder * 86400000;
  const iterator = pullRequests[Symbol.iterator]();

  for (let pullRequest of iterator) {
    const time = Date.parse(pullRequest.updated_at);
    const body = pullRequest.body;
    const number = pullRequest.number;
    const repoName = pullRequest.base.repo.name;
    const repoOwner = pullRequest.base.repo.owner.login;
    const reviewedLabel = pullRequest.reviewed.label;

    if (time + ims <= Date.now()) {
      checkInactivePullRequest.call(this, pullRequest);
    }

    const commits = await this.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number
    });
    const refIssues = commits.data.filter(c => {
      return this.findKeywords(c.commit.message);
    }).map(c => c.commit.message);
    const bodRef = this.findKeywords(body);

    if (bodRef || refIssues.length) {
      const com = refIssues[0];
      const ref = com ? com.match(/#([0-9]+)/)[1] : body.match(/#([0-9]+)/)[1];
      const data = {
        time: time,
        review: reviewedLabel
      };
      references.set(`${repoName}/${ref}`, data);
    }
  }

  const firstPage = await this.issues.getAll({
    filter: "all", per_page: 100,
    labels: this.cfg.activity.issues.inProgress
  });
  const issues = await this.getAll(firstPage);

  await scrapeInactiveIssues.apply(this, [references, issues]);
}

async function checkInactivePullRequest(pullRequest) {
  const author = pullRequest.user.login;
  const repoName = pullRequest.base.repo.name;
  const repoOwner = pullRequest.base.repo.owner.login;
  const number = pullRequest.number;

  const labels = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });
  const inactiveLabel = labels.data.find(l => {
    return l.name === this.cfg.activity.inactive;
  });
  const reviewedLabel = labels.data.find(l => {
    return l.name === this.cfg.activity.pullRequests.reviewed.label;
  });

  if (inactiveLabel || !reviewedLabel) return;

  const comment = this.templates.get("updateWarning")
    .replace(new RegExp("{author}", "g"), author)
    .replace(new RegExp("{days}", "g"), this.cfg.activity.check.reminder);

  const comments = await this.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const com = comments.data.slice(-1).pop();

  // Use end of line comments to check if comment is from template
  const lastComment = com ? com.body.endsWith("<!-- updateWarning -->") : null;
  const fromClient = com ? com.user.login === this.cfg.auth.username : null;

  if (reviewedLabel && !(lastComment && fromClient)) {
    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }
}

async function scrapeInactiveIssues(references, issues) {
  const ms = this.cfg.activity.check.limit * 86400000;
  const ims = this.cfg.activity.check.reminder * 86400000;
  const iterator = issues[Symbol.iterator]();

  for (let issue of iterator) {
    const number = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    const issueTag = `${repoName}/${number}`;
    const repoTag = issue.repository.full_name;

    const inactiveLabel = issue.labels.find(label => {
      return label.name === this.cfg.activity.inactive;
    });
    if (inactiveLabel) continue;
    if (references.has(issueTag) && !references.get(issueTag).review) continue;

    let time = Date.parse(issue.updated_at);
    const pullUpdateTime = references.get(issueTag).time;

    if (time < pullUpdateTime) time = pullUpdateTime;

    const active = this.cfg.activity.check.repositories.includes(repoTag);

    if (time + ms >= Date.now() || !active) continue;

    const aString = issue.assignees.map(assignee => assignee.login).join(", @");

    if (!aString) {
      const comment = "**ERROR:** This active issue has no assignee.";
      return this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: comment
      });
    }

    const c = this.templates.get("inactiveWarning")
      .replace(new RegExp("{assignee}", "g"), aString)
      .replace(new RegExp("{remind}", "g"), this.cfg.activity.check.reminder)
      .replace(new RegExp("{abandon}", "g"), this.cfg.activity.check.limit)
      .replace(new RegExp("{username}", "g"), this.cfg.auth.username);

    const issueComments = await this.issues.getComments({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    });
    const com = issueComments.data.slice(-1).pop();

    // Use end of line comments to check if comment is from template
    const warning = com ? com.body.endsWith("<!-- inactiveWarning -->") : null;
    const fromClient = com ? com.user.login === this.cfg.auth.username : null;

    if (warning && fromClient) {
      const assignees = JSON.stringify({
        assignees: aString.split(", @")
      });

      this.issues.removeAssigneesFromIssue({
        owner: repoOwner, repo: repoName, number: number, body: assignees
      });

      const warning = this.templates.get("abandonWarning")
        .replace(new RegExp("{assignee}", "g"), aString)
        .replace(new RegExp("{total}", "g"), (ms + ims) / 86400000)
        .replace(new RegExp("{username}", "g"), this.cfg.auth.username);

      this.issues.editComment({
        owner: repoOwner, repo: repoName, id: com.id, body: warning
      });
    } else if (!(warning && fromClient) && time + ims <= Date.now()) {
      this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: c
      });
    }
  }
}
