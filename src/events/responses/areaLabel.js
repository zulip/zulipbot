exports.run = async function(issue, repo, label) {
  const areaLabel = label.name;
  const number = issue.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const issueLabels = issue.labels.map(l => l.name);
  const areaLabels = this.cfg.issues.area.labels;

  if (areaLabels && !areaLabels.has(areaLabel)) return;

  const issueAreaLabels = issueLabels.filter(l => areaLabels.has(l));
  const labelTeams = issueAreaLabels.map(l => areaLabels.get(l));

  // Create unique array of teams (labels can point to same team)
  const uniqueTeams = this.util.deduplicate(labelTeams);

  const areaTeams = `@${repoOwner}/${uniqueTeams.join(`, @${repoOwner}/`)}`;

  const prefix = "CC by @zulipbot: ";

  const updatedIssue = {
    owner: repoOwner, repo: repoName, issue_number: number, body: issue.body
  };

  const pattern = new RegExp(`${prefix}.+$`, "mg");

  if (issue.description.includes(prefix)) {
    issue.body = issue.body.replace(pattern, `${prefix}${areaTeams}`);
  } else {
    issue.body += `\n\n${prefix}${areaTeams}`;
  }

  this.issues.update(updatedIssue);
};
