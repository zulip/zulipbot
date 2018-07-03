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

  const labels = args.match(/".*?"/g).map(string => string.replace(/"/g, ""));
  const removeLabels = issueLabels.filter(label => !labels.includes(label));
  const rejected = labels.filter(label => !issueLabels.includes(label));

  await this.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: number, labels: removeLabels
  });

  if (!rejected.length) return;

  const one = rejected.length === 1;
  const type = payload.issue.pull_request ? "pull request" : "issue";
  const error = this.templates.get("labelError")
    .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
    .replace(new RegExp("{labelList}", "g"), `"${rejected.join("\", \"")}"`)
    .replace(new RegExp("{exist}", "g"), `do${one ? "es" : ""} not exist`)
    .replace(new RegExp("{type}", "g"), type)
    .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
    .replace(new RegExp("{action}", "g"), "removed from");

  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.label.remove;
