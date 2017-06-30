let referencedIssues = [];

exports.run = (client, issue, repository, label) => {
  const areaLabel = label.name;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueLabels = issue.labels;
  if (!client.cfg.areaLabels.has(areaLabel)) return;
  client.issues.getComments({owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100})
  .then((issueComments) => {
    const issueAreaLabels = issueLabels.filter(l => client.cfg.areaLabels.has(l.name) && !issueLabels.includes(l.name)).map(l => l.name);
    const labelTeams = issueAreaLabels.map(l => client.cfg.areaLabels.get(l));
    const areaLabelTeams = Array.from(new Set(labelTeams)).join(`, @${repoOwner}/`);
    const referencedAreaLabels = issueAreaLabels.join("**, **");
    const comment = `Hello @${repoOwner}/${areaLabelTeams} members, this issue was labeled with the **${referencedAreaLabels}** label${labelTeams.length === 1 ? "" : "s"}, so you may want to check it out!`;
    const labelComment = issueComments.data.find(issueComment => issueComment.body.includes("this issue was labeled with the") && issueComment.user.login === client.cfg.username);
    if (labelComment) client.issues.editComment({owner: repoOwner, repo: repoName, id: labelComment.id, body: comment});
    else {
      if (referencedIssues.includes(issueNumber)) return;
      client.newComment(issue, repository, comment, issue.pull_request);
      referencedIssues.push(issueNumber);
      setTimeout(() => {
        referencedIssues.splice(referencedIssues.indexOf(issueNumber), 1);
      }, 1000);
    }
  });
};
