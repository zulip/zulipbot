"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const request = require("request-promise"); // for sending HTTP request to api.github.com
const cfg = require("../config.js"); // hidden config file

module.exports = exports = function(commenter, issueNumber, repoName, repoOwner) {
  let assignees = []; // initialize array for current issue assignees
  github.issues.get({ // get issue information
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((response) => {
    response.data.assignees.forEach((assignee) => {
      assignees.push(assignee.login); // push every assignee username of issue
    });
    if (!assignees.includes(commenter)) return; // return if commenter is not an assignee
    request({ // manually sending DELETE request because removeAssignees function in API wrapper doesn't work
      uri: `https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`,
      method: "DELETE",
      json: {
        assignees: [commenter]
      },
      headers: {
        "User-Agent": cfg.username // User-Agent required to be sent in headers
      },
      auth: {
        username: cfg.username,
        password: cfg.password
      }
    }).then((response) => {
      if (response.labels.find(label => label.name === cfg.inProgressLabel) && assignees.length === 1) { // if the "in progress" label exists and only one assignee
        github.issues.removeLabel({ // remove "in progress" label
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          name: cfg.inProgressLabel
        })
        .catch(console.error);
      }
    });
  });
};
