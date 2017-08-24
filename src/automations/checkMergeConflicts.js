exports.run = async function(client, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const func = client.pullRequests.getAll({
    owner: repoOwner, repo: repoName, per_page: 100
  });
  const pullRequests = await client.getAll(client, [], func);
  pullRequests.forEach(async(p, index) => {
    setTimeout(() => {
      exports.check(client, p.number, repoName, repoOwner);
    }, index * 500);
  });
};

exports.check = async function(client, number, repoName, repoOwner) {
  const pull = await client.pullRequests.get({
    owner: repoOwner, repo: repoName, number: number
  });
  const mergeable = pull.data.mergeable;
  const author = pull.data.user.login;
  const comment = client.templates.get("mergeConflictWarning").replace("[username]", author)
  .replace("[repoOwner]", repoOwner).replace("[repoName]", repoName);
  const comments = await client.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const warnings = comments.data.filter((c) => {
    return c.body.includes(comment) && c.user.login === client.cfg.username;
  });
  if (mergeable && warnings.length) {
    warnings.forEach((c) => {
      client.issues.deleteComment({
        owner: repoOwner, repo: repoName, id: c.id
      });
    });
  } else if (mergeable === false) {
    const commits = await client.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    });
    const lastCommitTime = Date.parse(commits.data.slice(-1).pop().commit.committer.date);
    const labelComment = warnings.find(c => lastCommitTime < Date.parse(c.updated_at));
    const labels = await client.issues.get({
      owner: repoOwner, repo: repoName, number: number
    });
    const inactive = labels.data.find(l => l.name === client.cfg.inactiveLabel);
    if (!labelComment && !inactive) client.newComment(pull.data, pull.data.base.repo, comment);
  }
};
