exports.run = async function(client, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const pullRequests = await getPullRequests(client, [], repoName, repoOwner);
  pullRequests.forEach(p => exports.check(client, p.number, repoName, repoOwner));
};

async function getPullRequests(client, pullRequests, repoName, repoOwner) {
  let response = await client.pullRequests.getAll({
    owner: repoOwner, repo: repoName, per_page: 100
  });
  pullRequests = pullRequests.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    pullRequests = pullRequests.concat(response.data);
  }
  return pullRequests;
}

exports.check = (client, number, repoName, repoOwner) => {
  client.pullRequests.get({
    owner: repoOwner, repo: repoName, number: number
  }).then((pull) => {
    const mergeable = pull.data.mergeable;
    const author = pull.data.user.login;
    const comment = client.templates.get("mergeConflictWarning").replace("[username]", author)
    .replace("[repoOwner]", repoOwner).replace("[repoName]", repoName);
    client.pullRequests.getCommits({
      owner: repoOwner, repo: repoName, number: number, per_page: 100
    }).then((commits) => {
      const lastCommitTime = Date.parse(commits.data.slice(-1).pop().commit.committer.date);
      client.issues.getComments({
        owner: repoOwner, repo: repoName, number: number, per_page: 100
      }).then((comments) => {
        const labelComment = comments.data.find((c) => {
          const synchCheck = lastCommitTime < Date.parse(c.updated_at);
          return c.body.includes(comment) && synchCheck && c.user.login === client.cfg.username;
        });
        if (!labelComment) {
          client.newComment(pull.data, pull.data.base.repo, comment);
        } else if (mergeable) {
          const oldComments = comments.data.filter((c) => {
            return c.body.includes(comment) && c.user.login === client.cfg.username;
          }).map(c => c.id);
          oldComments.forEach((c) => {
            client.issues.deleteComment({
              owner: repoOwner, repo: repoName, id: c
            });
          });
        }
      });
    });
  });
};
