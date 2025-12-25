import Search from "../structures/reference-search.js";

export const run = async function () {
  // Create array with PRs from all active repositories
  const repos = this.cfg.activity.check.repositories;
  const pages = repos.map(async (repo) => {
    const [repoOwner, repoName] = repo.split("/");
    return this.paginate(this.pulls.list, {
      owner: repoOwner,
      repo: repoName,
    });
  });

  const array = await Promise.all(pages);

  // Flatten arrays of arrays with PR data
  const pulls = array.flat();

  await scrapePulls.call(this, pulls);
};

async function scrapePulls(pulls) {
  const referenceList = new Map();
  const ims = this.cfg.activity.check.reminder * 86400000;

  for (const pull of pulls) {
    let time = Date.parse(pull.updated_at);
    const number = pull.number;
    const repoName = pull.base.repo.name;
    const repoOwner = pull.base.repo.owner.login;

    const response = await this.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });

    const labels = response.data.map((label) => label.name);

    const inactive = labels.find(
      (label) => label === this.cfg.activity.inactive,
    );
    const reviewed = labels.find(
      (l) => l === this.cfg.activity.pulls.reviewed.label,
    );
    const needsReview = labels.find(
      (l) => l === this.cfg.activity.pulls.needsReview.label,
    );

    if (time + ims <= Date.now() && !inactive && reviewed) {
      checkInactivePull.call(this, pull);
    }

    const references = new Search(this, pull, pull.base.repo);
    const bodyReferences = await references.getBody();
    const commitReferences = await references.getCommits();

    if (bodyReferences.length > 0 || commitReferences.length > 0) {
      const references_ = [...commitReferences, ...bodyReferences];
      for (const reference of references_) {
        const ignore = this.cfg.activity.pulls.needsReview.ignore;
        if (needsReview && ignore) time = Date.now();
        referenceList.set(`${repoName}/${reference}`, time);
      }
    }
  }

  const issues = await this.paginate(this.issues.list, {
    filter: "all",
    labels: this.cfg.activity.issues.inProgress,
  });

  await scrapeInactiveIssues.call(this, referenceList, issues);
}

async function checkInactivePull(pull) {
  const author = pull.user.login;
  const repoName = pull.base.repo.name;
  const repoOwner = pull.base.repo.owner.login;
  const number = pull.number;

  const template = this.templates.get("updateWarning");

  const comment = template.format({
    days: this.cfg.activity.check.reminder,
    author: author,
  });

  const comments = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  if (comments.length === 0) {
    this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });
  }
}

async function scrapeInactiveIssues(references, issues) {
  const ms = this.cfg.activity.check.limit * 86400000;
  const ims = this.cfg.activity.check.reminder * 86400000;

  for (const issue of issues) {
    const inactiveLabel = issue.labels.find(
      (label) => label.name === this.cfg.activity.inactive,
    );
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

    const logins = issue.assignees.map((assignee) => assignee.login);

    if (issue.assignees.length === 0) {
      const comment = "**ERROR:** This active issue has no assignee.";
      return this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: comment,
      });
    }

    const template = this.templates.get("inactiveWarning");

    const comment = template.format({
      assignee: logins.join(", @"),
      remind: this.cfg.activity.check.reminder,
      abandon: this.cfg.activity.check.limit,
      username: this.cfg.auth.username,
    });

    const comments = await template.getComments({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });

    if (comments.length > 0) {
      this.issues.removeAssignees({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        assignees: logins,
      });

      const warning = this.templates.get("abandonWarning").format({
        assignee: logins.join(", @"),
        total: (ms + ims) / 86400000,
        username: this.cfg.auth.username,
      });

      const id = comments[0].id;
      this.issues.updateComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: id,
        body: warning,
      });
    } else if (time + ims <= Date.now()) {
      this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: comment,
      });
    }
  }
}
