export const run = async function (repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const pulls = await this.util.getAllPages("pulls.list", {
    owner: repoOwner,
    repo: repoName,
  });

  for (const pull of pulls) {
    await check.call(this, pull.number, repo);
  }
};

async function check(number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const { branch, label, comment } = this.cfg.pulls.status.mergeConflicts;

  const pull = await this.pulls.get({
    owner: repoOwner,
    repo: repoName,
    pull_number: number,
  });

  const mergeable = pull.data.mergeable;
  const username = pull.data.user.login;

  const template = this.templates.get("mergeConflictWarning");
  const warning = template.format({
    username,
    branch,
    repoOwner,
    repoName,
  });

  const warnings = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  // Use a strict false check; unknown merge conflict statuses return null
  if (mergeable === false) {
    const commits = await this.util.getAllPages("pulls.listCommits", {
      owner: repoOwner,
      repo: repoName,
      pull_number: number,
    });
    const lastCommitTime = commits.slice(-1).pop().commit.committer.date;

    const warnComment = warnings.find(
      (c) => Date.parse(lastCommitTime) < Date.parse(c.created_at)
    );

    const labels = await this.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
    });
    const inactive = labels.data.find(
      (l) => l.name === this.cfg.activity.inactive
    );

    if (inactive) return;

    if (!warnComment && comment) {
      this.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        body: warning,
      });
    }

    if (label) {
      await this.issues.addLabels({
        owner: repoOwner,
        repo: repoName,
        issue_number: number,
        labels: [label],
      });
    }
  }
}
