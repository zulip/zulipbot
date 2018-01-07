exports.run = async function(client, body, issue, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const number = issue.number;
  const issueLabels = issue.labels.map(label => label.name);

  const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));
  const removeLabels = issueLabels.filter(label => !labels.includes(label));
  const rejected = labels.filter(label => !issueLabels.includes(label));

  await client.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: number, labels: removeLabels
  });

  if (!rejected.length) return;

  const one = rejected.length === 1;
  const payload = issue.pull_request ? "pull request" : "issue";
  const error = client.templates.get("labelError")
    .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
    .replace(new RegExp("{labelList}", "g"), `"${rejected.join("\", \"")}"`)
    .replace(new RegExp("{existState}", "g"), `do${one ? "es" : ""} not exist`)
    .replace(new RegExp("{payload}", "g"), payload)
    .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
    .replace(new RegExp("{action}", "g"), "removed from");

  client.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.label.remove;
exports.args = true;
