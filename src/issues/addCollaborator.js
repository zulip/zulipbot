"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const cfg = require("../config.js"); // hidden config file
const fs = require("fs"); // for reading welcome message
const newContributor = fs.readFileSync("./src/templates/newContributor.md", "utf8"); // get welcome message contents
const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(commenter, repoName, repoOwner, issueNumber) {
  const issueLabels = [cfg.inProgressLabel]; // create array for new issue labels
  const issueAssignees = [commenter]; // create array for new assignees
  github.repos.addCollaborator({ // give commenter read-only (pull) access
    owner: repoOwner,
    repo: repoName,
    username: commenter,
    permission: "pull"
  })
  .catch(console.error)
  .then(() => {
    github.issues.addAssigneesToIssue({ // add assignee
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      assignees: issueAssignees
    })
    .catch(console.error)
    .then(() => {
      if (cfg.addInProgressLabel) github.issues.addLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: issueLabels}).catch(console.error); // add labels
      newComment(repoOwner, repoName, issueNumber, "Congratulations, @" + commenter.concat(", ") + newContributor); // create new contributor welcome comment
    });
  });
};
