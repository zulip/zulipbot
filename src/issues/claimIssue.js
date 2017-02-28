"use strict";

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const addCollaborator = require("./addCollaborator.js");

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(commenter, issueNumber, repoName, repoOwner) {
  const issueLabels = ["in progress"]; // create array for new issue labels
  const issueAssignees = [commenter]; // create array for new assignees
  github.repos.checkCollaborator({ // check if commenter is a collaborator
    owner: repoOwner,
    repo: repoName,
    username: commenter
  })
  .then((response) => {
    if (response.meta.status === "204 No Content") {
      github.issues.addAssigneesToIssue({ // add assignee
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        assignees: issueAssignees
      })
      .catch(console.error)
      .then(
        github.issues.addLabels({ // add labels
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          labels: issueLabels
        })
        .catch(console.error)
      );
    }
  }, (response) => {
    if (response.headers.status === "404 Not Found") {
      addCollaborator(commenter, repoName, repoOwner, issueNumber);
    }
  });
};
