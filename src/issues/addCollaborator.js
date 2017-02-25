const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const fs = require("fs");
const newContributor = fs.readFileSync('./src/issues/newContributor.md', 'utf8');

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(commenter, repoName, repoOwner, issueNumber, issueAssignees, issueLabels) {
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
          github.issues.createComment({
            owner: repoOwner,
            repo: repoName,
            number: issueNumber,
            body: 'Congratulations, @' + commenter.concat(', ') + newContributor
          })
          .catch(console.error)
        )
      )
    )
}
