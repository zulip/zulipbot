let referenced = [];

exports.run = async function(issue, repository, label) {
  const areaLabel = label.name;
  const number = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueLabels = issue.labels.map(l => l.name);
  const areaLabels = this.cfg.issues.area.labels;

  if (areaLabels && !areaLabels.has(areaLabel)) return;

  const issueAreaLabels = issueLabels.filter(l => areaLabels.has(l));
  const labelTeams = issueAreaLabels.map(l => areaLabels.get(l));

  // Create unique array of teams (labels can point to same team)
  const uniqueTeams = Array.from(new Set(labelTeams));

  const areaTeams = `@${repoOwner}/` + uniqueTeams.join(`, @${repoOwner}/`);
  const references = issueAreaLabels.join("**, **");

  const payload = issue.pull_request ? "pull request" : "issue";
  const labelSize = labelTeams.length === 1 ? "label" : "labels";

  const comment = this.templates.get("areaLabelNotification")
    .replace(new RegExp("{teams}", "g"), areaTeams)
    .replace(new RegExp("{payload}", "g"), payload)
    .replace(new RegExp("{refs}", "g"), `**${references}**`)
    .replace(new RegExp("{labels}", "g"), labelSize);

  const issueComments = await this.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });
  const labelComment = issueComments.data.find(com => {
    // Use end of line comments to check if comment is from template
    const comment = com.body.endsWith("<!-- areaLabelNotification -->");
    const fromClient = com.user.login === this.cfg.auth.username;
    return comment && fromClient;
  });

  const tag = `${repoOwner}/${repoName}#${number}`;

  if (labelComment) {
    this.issues.editComment({
      owner: repoOwner, repo: repoName, id: labelComment.id, body: comment
    });
  } else if (!referenced.includes(tag)) {
    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });

    // Ignore labels added in bulk
    referenced.push(tag);
    setTimeout(() => {
      referenced.splice(referenced.indexOf(tag), 1);
    }, 1000);
  }
};
