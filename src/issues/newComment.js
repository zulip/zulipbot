"use strict"; // catch errors easier

module.exports = exports = function(client, repoOwner, repoName, issueNumber, body) {
  client.pullRequests.get({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((response) => {
    if (!body.includes("this pull request references an issue") && !body.includes("you have referenced an issue")) body = body.replace("issue", "pull request");
    if (client.cfg.escapeWIPString && response.data.title.includes(client.cfg.escapeWIPString) && body.includes("@") && !body.includes("Error")) return;
    client.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      body: body
    })
    .catch(console.error);
  }, () => {
    client.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      body: body
    })
    .catch(console.error);
  });
};
