let referencedIssues = [];

exports.run = async function(client, issue, repository, label) {
  const areaLabel = label.name;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueLabels = issue.labels.map(l => l.name);
  const areaLabels = client.cfg.issues.area.labels;

  if (!areaLabels.has(areaLabel)) return;

  const issueAreaLabels = issueLabels.filter(l => areaLabels.has(l));
  const labelTeams = issueAreaLabels.map(l => areaLabels.get(l));

  // Create unique array of teams (labels can point to same team)
  const uniqueTeams = Array.from(new Set(labelTeams));

  const areaTeams = `@${repoOwner}/` + uniqueTeams.join(`, @${repoOwner}/`);
  const references = issueAreaLabels.join("**, **");

  const payload = issue.pull_request ? "pull request" : "issue";
  const labelSize = labelTeams.length === 1 ? "label" : "labels";

  const comment = client.templates.get("areaLabelNotification")
    .replace(new RegExp("{teams}", "g"), areaTeams)
    .replace(new RegExp("{payload}", "g"), payload)
    .replace(new RegExp("{refs}", "g"), `**${references}**`)
    .replace(new RegExp("{labels}", "g"), labelSize);

  const issueComments = await client.issues.getComments({
    owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
  });
  const labelComment = issueComments.data.find(com => {
    // Use end of line comments to check if comment is from template
    const comment = com.body.endsWith("<!-- areaLabelNotification -->");
    const fromClient = com.user.login === client.cfg.auth.username;
    return comment && fromClient;
  });

  if (labelComment) {
    client.issues.editComment({
      owner: repoOwner, repo: repoName, id: labelComment.id, body: comment
    });
  } else if (!referencedIssues.includes(issueNumber)) {
    client.newComment(issue, repository, comment);

    // Ignore labels added in bulk
    referencedIssues.push(issueNumber);
    setTimeout(() => {
      referencedIssues.splice(referencedIssues.indexOf(issueNumber), 1);
    }, 1000);
  }
};
