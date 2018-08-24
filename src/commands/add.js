exports.run = async function(payload, commenter, args) {
  const creator = payload.issue.user.login;
  const self = this.cfg.issues.commands.label.self;
  const selfLabel = self.users ? !self.users.includes(commenter) : self;
  const forbidden = selfLabel && creator !== commenter;
  if (forbidden || !args.match(/".*?"/)) return this.util.respond(false);

  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const issueLabels = payload.issue.labels.map(label => label.name);

  const repoLabelArray = await this.util.getAllPages("issues.getLabels", {
    owner: repoOwner, repo: repoName
  });

  const repoLabels = repoLabelArray.map(label => label.name);
  const labels = args.match(/".*?"/g).map(string => string.replace(/"/g, ""));

  const alreadyAdded = labels.filter(label => issueLabels.includes(label));
  const rejected = labels.filter(label => !repoLabels.includes(label));
  const addLabels = labels.filter(label => {
    return repoLabels.includes(label) && !issueLabels.includes(label);
  });

  const response = await this.issues.addLabels({
    owner: repoOwner, repo: repoName, number: number, labels: addLabels
  });

  const type = payload.issue.pull_request ? "pull request" : "issue";
  const template = this.templates.get("labelError");

  if (rejected.length) {
    const one = rejected.length === 1;
    const error = template.format({
      labels: `Label${one ? "" : "s"}`, type: type,
      labelList: `"${rejected.join("\", \"")}"`,
      exist: `do${one ? "es" : ""} not exist`,
      beState: `w${one ? "as" : "ere"}`, action: "added to"
    });

    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  if (alreadyAdded.length) {
    const one = alreadyAdded.length === 1;
    const labels = alreadyAdded.join("\", \"");
    const error = template.format({
      labels: `Label${one ? "" : "s"}`, labelList: `"${labels}"`,
      exist: `already exist${one ? "s" : ""}`,
      beState: `w${one ? "as" : "ere"}`,
      action: "added to", type: type
    });

    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  return response;
};

exports.aliasPath = "label.add";
