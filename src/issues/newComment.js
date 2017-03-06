"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization

module.exports = exports = function(repoOwner, repoName, issueNumber, body) {
  github.pullRequests.get({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    body = body.replace(/issue/g, "pull request");
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
