"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const request = require("request"); // for sending HTTP request to api.github.com

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(commenter, issueNumber, repoName, repoOwner) {
  request({ // manually sending DELETE request because removeAssignees function in API wrapper doesn't work
    uri: `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`,
    method: "DELETE",
    json: {
      assignees: [commenter]
    },
    headers: {
      "User-Agent": "zulipbot" // User-Agent required to be sent in headers
    },
    auth: {
      username: cfg.username,
      password: cfg.password
    }
  }).on("response", () => {
    github.issues.getIssueLabels({ // get issue labels after issue is abandoned
      owner: repoOwner,
      repo: repoName,
      number: issueNumber
    }).then((response) => {
      if (response.data.find(label => label.name === "in progress")) { // if the "in progress" label exists
        github.issues.removeLabel({ // remove "in progress" label
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          name: "in progress"
        })
        .catch(console.error);
      }
    });
  });
};
