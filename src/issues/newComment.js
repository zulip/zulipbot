"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(repoOwner, repoName, issueNumber, body) {
  github.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber,
    body: body
  })
  .catch(console.error);
};
