exports.run = async function(repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const pulls = await this.util.getAllPages("pullRequests.getAll", {
    owner: repoOwner, repo: repoName
  });
  const iterator = pulls[Symbol.iterator]();

  for (const pull of iterator) {
    await check.apply(this, [pull.number, repo]);
  }
};

async function check(number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const pull = await this.pullRequests.get({
    owner: repoOwner, repo: repoName, number: number
  });

  const mergeable = pull.data.mergeable;

  const template = this.templates.get("mergeConflictWarning");
  const comment = template.format({
    username: pull.data.user.login, repoOwner: repoOwner, repoName: repoName
  });

  const warnings = await template.getComments({
    owner: repoOwner, repo: repoName, number: number
  });

  // Use a strict false check; unknown merge conflict statuses return undefined
  if (mergeable === false) {
    const commits = await this.util.getAllPages("pullRequests.getCommits", {
      owner: repoOwner, repo: repoName, number: number
    });
    const lastCommitTime = commits.slice(-1).pop().commit.committer.date;

    const labelComment = warnings.find(c => {
      return Date.parse(lastCommitTime) < Date.parse(c.created_at);
    });

    const labels = await this.issues.getIssueLabels({
      owner: repoOwner, repo: repoName, number: number
    });
    const inactive = labels.data.find(l => {
      return l.name === this.cfg.activity.inactive;
    });

    if (!labelComment && !inactive) {
      this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: comment
      });
    }
  }

  return new Promise(resolve => resolve());
}
