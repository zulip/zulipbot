let referenced = [];

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

  const areaTeams = `@${repoOwner}/` + uniqueTeams.join(`, @${repoOwner}/`);
  const references = issueAreaLabels.join("\", \"");

  const payload = issue.pull_request ? "pull request" : "issue";
  const labelSize = labelTeams.length === 1 ? "label" : "labels";

  const comment = this.templates.get("areaLabelAdded")
    .replace(new RegExp("{teams}", "g"), areaTeams)
    .replace(new RegExp("{payload}", "g"), payload)
    .replace(new RegExp("{refs}", "g"), `"${references}"`)
    .replace(new RegExp("{labels}", "g"), labelSize);

  const comments = await this.util.getTemplates("areaLabelAdded", {
    owner: repoOwner, repo: repoName, number: number
  });

  const tag = `${repoOwner}/${repoName}#${number}`;

  if (comments.length) {
    if (issueAreaLabels.length) {
      this.issues.editComment({
        owner: repoOwner, repo: repoName, id: comments[0].id, body: comment
      });
    } else {
      this.issues.deleteComment({
        owner: repoOwner, repo: repoName, id: comments[0].id
      });
    }
  } else if (!referenced.includes(tag) && issueAreaLabels.length) {
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
