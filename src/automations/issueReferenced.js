exports.run = async function(pullRequest, repository, opened) {
  const author = pullRequest.user.login;
  const number = pullRequest.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  const response = await this.pullRequests.getCommits({
    owner: repoOwner, repo: repoName, number: number
  });
  const refIssues = response.data.filter(c => {
    return this.findKeywords(c.commit.message);
  }).map(c => c.commit.message.match(/#([0-9]+)/)[1]);

  if (!refIssues.length && this.findKeywords(pullRequest.body)) {
    const comment = this.templates.get("fixCommitMessage")
      .replace(new RegExp("{author}", "g"), author);
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }

  if (!opened) return;

  Array.from(new Set(refIssues)).forEach(issue => {
    if (this.cfg.issues.area.references) {
      areaReference.apply(this, [issue, number, repository]);
    }

    if (this.cfg.pullRequests.references.labels) {
      labelReference.apply(this, [issue, number, repository]);
    }
  });
};

async function areaReference(refIssue, number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const labels = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: refIssue
  });
  const issueLabels = labels.data.filter(l => {
    return this.cfg.issues.area.labels.has(l.name);
  }).map(l => l.name);

  const teams = issueLabels.map(l => this.cfg.issues.area.labels.get(l));

  if (!teams.length) return;

  // Create unique array of teams (labels can point to same team)
  const unique = Array.from(new Set(teams));

  const uniqueTeams = `@${repoOwner}/` + unique.join(`, @${repoOwner}/`);
  const areaLabels = issueLabels.join("\", \"");

  const labelSize = issueLabels.length === 1 ? "label" : "labels";

  const comment = this.templates.get("areaLabelNotification")
    .replace(new RegExp("{teams}", "g"), uniqueTeams)
    .replace(new RegExp("{payload}", "g"), "pull request")
    .replace(new RegExp("{refs}", "g"), `"${areaLabels}"`)
    .replace(new RegExp("{labels}", "g"), labelSize);

  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: comment
  });
}

async function labelReference(refIssue, number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const labelCfg = this.cfg.pullRequests.references.labels;

  const response = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: refIssue
  });

  let labels = response.data.map(label => label.name);

  if (typeof labelCfg === "object") {
    const cfgCheck = [labelCfg.include, labelCfg.exclude];

    const defined = arr => Array.isArray(arr) && arr.length;

    if (cfgCheck.filter(defined).length !== 1) {
      const error = "**ERROR:** Invalid `references.labels` configuration.";
      return this.issues.createComment({
        owner: repoOwner, repo: repoName, number: number, body: error
      });
    }

    if (defined(labelCfg.include)) {
      labels = labels.filter(label => labelCfg.include.includes(label));
    }

    if (defined(labelCfg.exclude)) {
      labels = labels.filter(label => !labelCfg.exclude.includes(label));
    }
  }

  this.issues.addLabels({
    owner: repoOwner, repo: repoName, number: number, labels: labels
  });
}
