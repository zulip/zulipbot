exports.run = async function(pull, repo, opened) {
  const body = pull.body;
  const author = pull.user.login;
  const number = pull.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const commits = await this.pullRequests.getCommits({
    owner: repoOwner, repo: repoName, number: number
  });

  const msgs = commits.data.map(c => c.commit.message);
  const commitRefs = await this.util.getReferences(msgs, repoOwner, repoName);
  const bodyRefs = await this.util.getReferences([body], repoOwner, repoName);

  const comments = await this.issues.getComments({
    owner: repoOwner, repo: repoName, number: number, per_page: 100
  });

  const warnings = comments.data.filter(com => {
    // Use end of line comments to check if comment is from template
    const warn = com.body.endsWith("<!-- fixCommitMessage -->");
    const fromClient = com.user.login === this.cfg.auth.username;
    return warn && fromClient;
  });

  if (!warnings.length && !bodyRefs.some(r => commitRefs.includes(r))) {
    const comment = this.templates.get("fixCommitMessage")
      .replace(new RegExp("{author}", "g"), author);
    return this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: comment
    });
  }

  if (!opened || !this.cfg.pulls.references.labels) return;

  commitRefs.forEach(issue => {
    labelReference.apply(this, [issue, number, repo]);
  });
};

async function labelReference(refIssue, number, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  const labelCfg = this.cfg.pulls.references.labels;

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
