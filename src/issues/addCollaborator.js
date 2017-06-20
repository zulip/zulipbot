"use strict"; // catch errors easier

const fs = require("fs"); // for reading welcome message
const newContributor = fs.readFileSync("./src/templates/newContributor.md", "utf8"); // get welcome message contents
const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(client, commenter, repoName, repoOwner, issueNumber) {
  const issueLabels = [client.cfg.inProgressLabel]; // create array for new issue labels
  const issueAssignees = [commenter]; // create array for new assignees
  if (!client.cfg.addCollabPermission) return;
  client.repos.addCollaborator({ // give commenter read-only (pull) access
    owner: repoOwner,
    repo: repoName,
    username: commenter,
    permission: client.cfg.addCollabPermission
  })
  .catch(console.error)
  .then(() => {
    client.issues.addAssigneesToIssue({ // add assignee
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      assignees: issueAssignees
    })
    .catch(console.error)
    .then(() => {
      if (client.cfg.inProgressLabel) client.issues.addLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: issueLabels}).catch(console.error); // add labels
      newComment(client, repoOwner, repoName, issueNumber, newContributor.replace("[commenter]", commenter)); // create new contributor welcome comment
    });
  });
};
