"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const issueReferenced = require("../pullRequests/issueReferenced.js"); // create comment

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  github.pullRequests.get({ // check if issue was referenced on a PR
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    issueReferenced(body, issueNumber, repoName, repoOwner); // pull-request-to-issue reference
  }, () => {
    return; // escape issue-to-issue references
  });
};
