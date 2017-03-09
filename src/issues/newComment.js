"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization

module.exports = exports = function(repoOwner, repoName, issueNumber, body) {
  github.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber,
    body: body
  })
  .catch(console.error);
};
