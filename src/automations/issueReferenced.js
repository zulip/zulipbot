exports.run = (client, pullRequest, repository) => {
  const author = pullRequest.user.login;
  const number = pullRequest.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.pullRequests.getCommits({
    owner: repoOwner, repo: repoName, number: number
  }).then((response) => {
    const refIssues = response.data.filter((c) => {
      return c.commit.message.match(/#([0-9]+)/);
    }).map(c => c.commit.message.match(/#([0-9]+)/)[1]);
    if (!refIssues.length) {
      const comment = client.templates.get("fixCommitMessage").replace("[author]", author);
      return client.newComment(pullRequest, repository, comment);
    }
    Array.from(new Set(refIssues)).forEach((referencedIssue) => {
      exports.referenceIssue(client, referencedIssue, pullRequest, repository);
    });
  });
};

exports.referenceIssue = (client, referencedIssue, pullRequest, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: referencedIssue
  }).then((labels) => {
    const issueLabels = labels.data.filter((l) => {
      return client.cfg.areaLabels.has(l.name);
    }).map(l => l.name);
    const teams = issueLabels.map(l => client.cfg.areaLabels.get(l));
    const uniqueTeams = `@${repoOwner}/` + Array.from(new Set(teams)).join(`, @${repoOwner}/`);
    const areaLabels = issueLabels.join("\", \"");
    const labelSize = issueLabels.length === 1 ? "" : "s";
    const comment = client.templates.get("areaLabelNotification").replace("[teams]", uniqueTeams)
    .replace("[payload]", "pull request").replace("[refs]", `"${areaLabels}"`).replace("[labels]", labelSize);
    client.newComment(pullRequest, repository, comment);
  });
};
