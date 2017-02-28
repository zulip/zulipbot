"use strict";

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const request = require("request");

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(commenter, issueNumber, repoName, repoOwner) {
  request({
    uri: `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`,
    method: "DELETE",
    json: {
      "assignees": [commenter]
    },
    headers: {
      'User-Agent': 'zulipbot'
    },
    'auth': {
      'username': cfg.username,
      'password': cfg.password
    }
  }).on('response', () => {
    github.issues.getIssueLabels({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber
    }).then((response) => {
      if (response.find(label => label.name === "in progress")) {
        github.issues.removeLabel({
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          name: "in progress"
        })
        .catch(console.error)
      }
    })
  });
}
