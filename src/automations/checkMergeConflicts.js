exports.run = async function(client, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  const firstPage = await client.pullRequests.getAll({
    owner: repoOwner, repo: repoName, per_page: 100
  });
  const pullRequests = await client.getAll(firstPage);
  const iterator = pullRequests[Symbol.iterator]();

  for (let pullRequest of iterator) {
    await check(client, pullRequest.number, repoName, repoOwner);
  }
};

async function check(client, number, repoName, repoOwner) {
  const pull = await client.pullRequests.get({
    owner: repoOwner, repo: repoName, number: number
  });

  const mergeable = pull.data.mergeable;
  const author = pull.data.user.login;

  const comment = client.templates.get("mergeConflictWarning")
    .replace(new RegExp("{username}", "g"), author)
    .replace(new RegExp("{repoOwner}", "g"), repoOwner)
    .replace(new RegExp("{repoName}", "g"), repoName);

  const comments = await client.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });

  const warnings = comments.data.filter(com => {
    // Use end of line comments to check if comment is from template
    const warn = com.body.endsWith("<!-- mergeConflictWarning -->");
    const fromClient = com.user.login === client.cfg.auth.username;
    return warn && fromClient;
  });

  // Use a strict false check; unknown merge conflict statuses return undefined
  if (mergeable === false) {
    const commits = await client.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    });
    const lastCommitTime = commits.data.slice(-1).pop().commit.committer.date;

    const labelComment = warnings.find(c => {
      return Date.parse(lastCommitTime) < Date.parse(c.created_at);
    });

    const labels = await client.issues.getIssueLabels({
      owner: repoOwner, repo: repoName, number: number
    });
    const inactive = labels.data.find(l => {
      return l.name === client.cfg.activity.inactive;
    });

    if (!labelComment && !inactive) {
      client.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: comment
      });
    }
  } else if (mergeable && warnings.length) {
    warnings.forEach(c => {
      client.issues.deleteComment({
        owner: repoOwner, repo: repoName, id: c.id
      });
    });
  }

  return new Promise(resolve => resolve());
}
