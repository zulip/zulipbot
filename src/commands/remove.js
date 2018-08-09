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

  const error = this.util.formatTemplate("labelError", {
    labels: `Label${one ? "" : "s"}`,
    labelList: `"${rejected.join("\", \"")}"`,
    exist: `do${one ? "es" : ""} not exist`,
    type: type,
    beState: `w${one ? "as" : "ere"}`,
    action: "removed from"
  });

  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.label.remove;
