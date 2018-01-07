exports.run = async function(client, body, issue, repository) {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const number = issue.number;
  const issueLabels = issue.labels.map(label => label.name);

  const repoLabelArray = await client.issues.getLabels({
    owner: repoOwner, repo: repoName, per_page: 100
  });

  const repoLabels = repoLabelArray.data.map(label => label.name);
  const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));

  const alreadyAdded = labels.filter(label => issueLabels.includes(label));
  const rejected = labels.filter(label => !repoLabels.includes(label));
  const addLabels = labels.filter(label => {
    return repoLabels.includes(label) && !issueLabels.includes(label);
  });

  await client.issues.addLabels({
    owner: repoOwner, repo: repoName, number: number, labels: addLabels
  });

  const payload = issue.pull_request ? "pull request" : "issue";

  if (rejected.length) {
    const one = rejected.length === 1;
    const error = client.templates.get("labelError")
      .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
      .replace(new RegExp("{labelList}", "g"), `"${rejected.join("\", \"")}"`)
      .replace(new RegExp("{existState}", "g"), `do${one ? "es" : ""}`)
      .replace(new RegExp("{payload}", "g"), payload)
      .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
      .replace(new RegExp("{action}", "g"), "added to");

    client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }

  if (alreadyAdded.length) {
    const one = alreadyAdded.length === 1;
    const labels = alreadyAdded.join("\", \"");
    const error = client.templates.get("labelError")
      .replace(new RegExp("{labels}", "g"), `Label${one ? "" : "s"}`)
      .replace(new RegExp("{labelList}", "g"), `"${labels}"`)
      .replace(new RegExp("{existState}", "g"), `already ${one ? "s" : ""}`)
      .replace(new RegExp("{payload}", "g"), payload)
      .replace(new RegExp("{beState}", "g"), `w${one ? "as" : "ere"}`)
      .replace(new RegExp("{action}", "g"), "added to");

    client.issues.createComment({
      owner: repoOwner, repo: repoName, number: number, body: error
    });
  }
};

const cfg = require("../../config/default.js");
exports.aliases = cfg.issues.commands.label.add;
exports.args = true;
