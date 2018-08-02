exports.run = async function() {
  // Create array with PRs from all active repositories
  const repos = this.cfg.activity.check.repositories;
  const pages = repos.map(async repo => {
    const repoOwner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    return this.util.getAllPages("pullRequests.getAll", {
      owner: repoOwner, repo: repoName
    });
  });

  const array = await Promise.all(pages);

  // Flatten arrays of arrays with PR data
  const pulls = array.reduce((a, element) => {
    return a.concat(element);
  }, []);

  await scrapePulls.call(this, pulls);
};

async function scrapePulls(pulls) {
  const references = new Map();
  const ims = this.cfg.activity.check.reminder * 86400000;
  const iterator = pulls[Symbol.iterator]();

  for (let pull of iterator) {
    let time = Date.parse(pull.updated_at);
    const body = pull.body;
    const number = pull.number;
    const repoName = pull.base.repo.name;
    const repoOwner = pull.base.repo.owner.login;

    const response = await this.issues.getIssueLabels({
      owner: repoOwner, repo: repoName, number: number
    });

    const labels = response.data.map(label => label.name);

    const inactive = labels.find(label => label === this.cfg.activity.inactive);
    const reviewed = labels.find(l => {
      return l === this.cfg.activity.pulls.reviewed.label;
    });
    const needsReview = labels.find(l => {
      return l === this.cfg.activity.pulls.needsReview.label;
    });

    if (time + ims <= Date.now() && !inactive && reviewed) {
      checkInactivePull.call(this, pull);
    }

    const commits = await this.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number
    });
    const msgs = commits.data.map(c => c.commit.message);
    const commitRefs = await this.util.getReferences(msgs, pull.base.repo);
    const bodyRef = await this.util.getReferences([body], pull.base.repo);

    if (bodyRef.length || commitRefs.length) {
      const refs = commitRefs.concat(bodyRef);
      refs.forEach(ref => {
        const ignore = this.cfg.activity.pulls.needsReview.ignore;
        if (needsReview && ignore) time = Date.now();
        references.set(`${repoName}/${ref}`, time);
      });
    }
  }

  const issues = await this.util.getAllPages("issues.getAll", {
    filter: "all", labels: this.cfg.activity.issues.inProgress
  });

  await scrapeInactiveIssues.apply(this, [references, issues]);
}

async function checkInactivePull(pull) {
  const author = pull.user.login;
  const repoName = pull.base.repo.name;
  const repoOwner = pull.base.repo.owner.login;
  const number = pull.number;

  const comment = this.templates.get("updateWarning")
    .replace(new RegExp("{author}", "g"), author)
    .replace(new RegExp("{days}", "g"), this.cfg.activity.check.reminder);

  const comments = await this.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const com = comments.data.slice(-1).pop();

  // Use end of line comments to check if comment is from template
  const lastComment = com && com.body.endsWith("<!-- updateWarning -->");
  const fromClient = com && com.user.login === this.cfg.auth.username;

  if (!lastComment || !fromClient) {
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
    const inactiveLabel = issue.labels.find(label => {
      return label.name === this.cfg.activity.inactive;
    });
    if (inactiveLabel) continue;

    let time = Date.parse(issue.updated_at);
    const number = issue.number;
    const repoName = issue.repository.name;
    const repoOwner = issue.repository.owner.login;
    const issueTag = `${repoName}/${number}`;
    const repoTag = issue.repository.full_name;

    if (time < references.get(issueTag)) time = references.get(issueTag);

    const active = this.cfg.activity.check.repositories.includes(repoTag);

    if (time + ms >= Date.now() || !active) continue;

    const logins = issue.assignees.map(assignee => assignee.login);

    if (!issue.assignees.length) {
      const comment = "**ERROR:** This active issue has no assignee.";
      return this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: comment
      });
    }

    const c = this.templates.get("inactiveWarning")
      .replace(new RegExp("{assignee}", "g"), logins.join(", @"))
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
      this.issues.removeAssigneesFromIssue({
        owner: repoOwner, repo: repoName, number: number, assignees: logins
      });

      const warning = this.templates.get("abandonWarning")
        .replace(new RegExp("{assignee}", "g"), logins.join(", @"))
        .replace(new RegExp("{total}", "g"), (ms + ims) / 86400000)
        .replace(new RegExp("{username}", "g"), this.cfg.auth.username);

      this.issues.editComment({
        owner: repoOwner, repo: repoName, id: com.id, body: warning
      });
    } else if (time + ims <= Date.now()) {
      this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: c
      });
    }
  }
}
