exports.run = (client, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  exports.getAllPullRequests(client, [], repoName, repoOwner, 1);
};

exports.getAllPullRequests = (client, pullRequests, repoName, repoOwner, pageCount) => {
  client.pullRequests.getAll({owner: repoOwner, repo: repoName, sort: "updated", direction: "desc", per_page: 100})
  .then((res) => {
    pullRequests = pullRequests.concat(res.data);
    if (client.hasNextPage(res)) {
      exports.getAllPullRequests(pullRequests, repoName, repoOwner, pageCount + 1);
    } else {
      pullRequests.forEach(p => exports.check(client, p.number, repoName, repoOwner));
    }
  });
};

exports.check = (client, number, repoName, repoOwner) => {
  client.pullRequests.get({owner: repoOwner, repo: repoName, number: number})
  .then((pull) => {
    const mergeable = pull.data.mergeable;
    if (mergeable) return;
    const author = pull.data.user.login;
    const comment = client.templates.get("mergeConflictWarning").replace("[username]", author).replace("[repoOwner]", repoOwner).replace("[repoName]", repoName);
    const oldComment = "merge conflict";
    client.pullRequests.getCommits({owner: repoOwner, repo: repoName, number: number, per_page: 100}).then((commits) => {
      const lastCommitTime = Date.parse(commits.data.slice(-1).pop().commit.committer.date);
      client.issues.getComments({owner: repoOwner, repo: repoName, number: number, per_page: 100}).then((comments) => {
        const labelComment = comments.data.find((c) => {
          const synchCheck = lastCommitTime < Date.parse(c.updated_at);
          return c.body.includes(oldComment) && synchCheck && c.user.login === client.cfg.username;
        });
        if (!labelComment) client.newComment(pull.data, pull.data.base.repo, comment);
      });
    });
  });
};
