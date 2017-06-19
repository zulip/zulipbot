"use strict"; // catch errors easier

module.exports = exports = function(github, repoOwner, repoName, issueNumber, body) {
  github.pullRequests.get({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((response) => {
    if (!body.includes("this pull request references an issue") && !body.includes("you have referenced an issue")) body = body.replace("issue", "pull request");
    if (github.cfg.escapeWIPString && response.data.title.includes(github.cfg.escapeWIPString) && body.includes("@") && !body.includes("Error")) return;
    github.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      body: body
    })
    .catch(console.error);
  }, () => {
    github.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      body: body
    })
    .catch(console.error);
  });
};
