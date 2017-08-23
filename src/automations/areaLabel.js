let referencedIssues = [];

exports.run = (client, issue, repository, label) => {
  const areaLabel = label.name;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueLabels = issue.labels;
  if (!client.cfg.areaLabels.has(areaLabel)) return;
  client.issues.getComments({
    owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
  }).then((issueComments) => {
    const issueAreaLabels = issueLabels.filter((l) => {
      return client.cfg.areaLabels.has(l.name) && !issueLabels.includes(l.name);
    }).map(l => l.name);
    const labelTeams = issueAreaLabels.map(l => client.cfg.areaLabels.get(l));
    const areaTeams = `@${repoOwner}/` + Array.from(new Set(labelTeams)).join(`, @${repoOwner}/`);
    const references = issueAreaLabels.join("**, **");
    const payload = issue.pull_request ? "pull request" : "issue";
    const labelSize = labelTeams.length === 1 ? "label" : "labels";
    const comment = client.templates.get("areaLabelNotification").replace("[teams]", areaTeams)
    .replace("[payload]", payload).replace("[refs]", `**${references}**`).replace("[labels]", labelSize);
    const labelComment = issueComments.data.find((issueComment) => {
      return issueComment.body.includes(comment.slice(-30)) && issueComment.user.login === client.cfg.username;
    });
    if (labelComment) {
      client.issues.editComment({
        owner: repoOwner, repo: repoName, id: labelComment.id, body: comment
      });
    } else {
      if (referencedIssues.includes(issueNumber)) return;
      client.newComment(issue, repository, comment);
      referencedIssues.push(issueNumber);
      setTimeout(() => {
        referencedIssues.splice(referencedIssues.indexOf(issueNumber), 1);
      }, 1000);
    }
  });
};
