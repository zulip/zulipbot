exports.run = (client, body, issue, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueNumber = issue.number;
  const issueLabels = issue.labels.map(label => label.name);
  const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));
  const removeLabels = issueLabels.filter(label => !labels.includes(label));
  const rejected = labels.filter(label => !issueLabels.includes(label));
  client.issues.replaceAllLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: removeLabels})
  .then(() => {
    if (!rejected.length) return;
    const rejectedLabelError = `**ERROR:** Label${rejected.length === 1 ? "" : "s"} "${rejected.join("\", \"")}" do${rejected.length === 1 ? "es" : ""} not exist and w${rejected.length === 1 ? "as" : "ere"} thus not removed from this [payload].`;
    client.newComment(issue, repository, rejectedLabelError, issue.pull_request);
  });
};

exports.name = "remove";
exports.aliases = require("../config.js").removeCommands;
exports.args = true;
