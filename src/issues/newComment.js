"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization

module.exports = exports = function(repoOwner, repoName, issueNumber, body) {
  github.pullRequests.get({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((response) => {
    if (!body.includes("this pull request references an issue")) body = body.replace("issue", "pull request");
    if (response.data.title.includes("WIP") && body.includes("@") && !body.includes("Error")) return;
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
