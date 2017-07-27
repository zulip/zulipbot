exports.run = (client, body, issue, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueNumber = issue.number;
  const issueLabels = issue.labels.map(label => label.name);
  client.issues.getLabels({owner: repoOwner, repo: repoName, per_page: 100})
  .then((repoLabelArray) => {
    const repoLabels = repoLabelArray.data.map(label => label.name);
    const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));
    const alreadyAdded = labels.filter(label => issueLabels.includes(label));
    const addLabels = labels.filter(label => repoLabels.includes(label) && !issueLabels.includes(label));
    const rejected = labels.filter(label => !repoLabels.includes(label));
    client.issues.addLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: addLabels})
    .then(() => {
      if (rejected.length) {
        const rejectedLabelError = `**ERROR:** Label${rejected.length === 1 ? "" : "s"} "${rejected.join("\", \"")}" do${rejected.length === 1 ? "es" : ""} not exist and w${rejected.length === 1 ? "as" : "ere"} thus not added to this [payload].`;
        client.newComment(issue, repository, rejectedLabelError, issue.pull_request);
      }
      if (alreadyAdded.length) {
        const alreadyAddedError = `**ERROR:** Label${alreadyAdded.length === 1 ? "" : "s"} "${alreadyAdded.join("\", \"")}" already exist${alreadyAdded.length === 1 ? "s" : ""} and w${alreadyAdded.length === 1 ? "as" : "ere"} thus not added again to this [payload].`;
        client.newComment(issue, repository, alreadyAddedError, issue.pull_request);
      }
    });
  });
};

exports.aliases = require("../config.js").labelCommands;
exports.args = true;
