exports.run = async function(payload, commenter, args) {
  const creator = payload.issue.user.login;
  const self = this.cfg.issues.commands.label.self;
  const selfLabel = self.users ? !self.users.includes(commenter) : self;
  const forbidden = selfLabel && creator !== commenter;
  if (forbidden || !args.match(/".*?"/)) return;

  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const issueLabels = payload.issue.labels.map(label => label.name);

  const repoLabelArray = await this.issues.getLabels({
    owner: repoOwner, repo: repoName, per_page: 100
  });

  const repoLabels = repoLabelArray.data.map(label => label.name);
  const labels = args.match(/".*?"/g).map(string => string.replace(/"/g, ""));

  const alreadyAdded = labels.filter(label => issueLabels.includes(label));
  const rejected = labels.filter(label => !repoLabels.includes(label));
  const addLabels = labels.filter(label => {
    return repoLabels.includes(label) && !issueLabels.includes(label);
  });

  await this.issues.addLabels({
    owner: repoOwner, repo: repoName, number: number, labels: addLabels
  });

  const type = payload.issue.pull_request ? "pull request" : "issue";

  if (rejected.length) {
    const one = rejected.length === 1;
    const error = this.templates.get("labelError")
      .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
      .replace(new RegExp("{labelList}", "g"), `"${rejected.join("\", \"")}"`)
      .replace(new RegExp("{exist}", "g"), `do${one ? "es" : ""} not exist`)
      .replace(new RegExp("{type}", "g"), type)
      .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
      .replace(new RegExp("{action}", "g"), "added to");

    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  if (alreadyAdded.length) {
    const one = alreadyAdded.length === 1;
    const labels = alreadyAdded.join("\", \"");
    const error = this.templates.get("labelError")
      .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
      .replace(new RegExp("{labelList}", "g"), `"${labels}"`)
      .replace(new RegExp("{exist}", "g"), `already exist${one ? "s" : ""}`)
      .replace(new RegExp("{type}", "g"), type)
      .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
      .replace(new RegExp("{action}", "g"), "added to");

    this.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.label.add;
