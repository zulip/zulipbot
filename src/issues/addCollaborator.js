"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const fs = require("fs"); // for reading welcome message
const newContributor = fs.readFileSync("./src/issues/newContributor.md", "utf8"); // get welcome message contents
const newComment = require("./newComment.js"); // create comment

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(commenter, repoName, repoOwner, issueNumber) {
  const issueLabels = ["in progress"]; // create array for new issue labels
  const issueAssignees = [commenter]; // create array for new assignees
  github.repos.addCollaborator({ // give commenter read-only (pull) access
    owner: repoOwner,
    repo: repoName,
    username: commenter,
    permission: "pull"
  })
  .catch(console.error)
  .then(
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
      .then(
        newComment(repoOwner, repoName, issueNumber, "Congratulations, @" + commenter.concat(", ") + newContributor) // create new contributor welcome comment
      )
    )
  );
};
