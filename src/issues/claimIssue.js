"use strict"; // catch errors easier

const addCollaborator = require("./addCollaborator.js"); // add collaborator

module.exports = exports = (client, commenter, issueNumber, repoName, repoOwner) => {
  const issueLabels = [client.cfg.inProgressLabel]; // create array for new issue labels
  const issueAssignees = [commenter]; // create array for new assignees
  client.repos.checkCollaborator({ // check if commenter is a collaborator
    owner: repoOwner,
    repo: repoName,
    username: commenter
  })
  .then((response) => {
    if (response.meta.status === "204 No Content") { // if user is already collaborator
      client.issues.addAssigneesToIssue({ // add assignee
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        assignees: issueAssignees
      })
      .catch(console.error)
      .then(() => {
        if (client.cfg.inProgressLabel) client.issues.addLabels({owner: repoOwner, repo: repoName, number: issueNumber, labels: issueLabels}).catch(console.error); // add labels
      });
    }
  }, (response) => {
    if (response.headers.status === "404 Not Found") { // if user isn't a collaborator yet
      addCollaborator(client, commenter, repoName, repoOwner, issueNumber); // make them a collaborator
    }
  });
};
