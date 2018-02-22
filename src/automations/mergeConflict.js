exports.run = async function(repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const firstPage = await this.pullRequests.getAll({
    owner: repoOwner, repo: repoName, per_page: 100
  });
  const pulls = await this.getAll(firstPage);
  const iterator = pulls[Symbol.iterator]();

  for (let pull of iterator) {
    await check.apply(this, [pull.number, repoName, repoOwner]);
  }
};

async function check(number, repoName, repoOwner) {
  const pull = await this.pullRequests.get({
    owner: repoOwner, repo: repoName, number: number
  });

  const mergeable = pull.data.mergeable;
  const author = pull.data.user.login;

  const comment = this.templates.get("mergeConflictWarning")
    .replace(new RegExp("{username}", "g"), author)
    .replace(new RegExp("{repoOwner}", "g"), repoOwner)
    .replace(new RegExp("{repoName}", "g"), repoName);

  const comments = await this.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });

  const warnings = comments.data.filter(com => {
    // Use end of line comments to check if comment is from template
    const warn = com.body.endsWith("<!-- mergeConflictWarning -->");
    const fromClient = com.user.login === this.cfg.auth.username;
    return warn && fromClient;
  });

  // Use a strict false check; unknown merge conflict statuses return undefined
  if (mergeable === false) {
    const commits = await this.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    });
    const lastCommitTime = commits.data.slice(-1).pop().commit.committer.date;

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
  } else if (mergeable && warnings.length) {
    warnings.forEach(c => {
      this.issues.deleteComment({
        owner: repoOwner, repo: repoName, id: c.id
      });
    });
  }

  return new Promise(resolve => resolve());
}
