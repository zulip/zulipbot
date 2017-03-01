"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const request = require("request"); // for sending HTTP request to api.github.com

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
        "User-Agent": "zulipbot" // User-Agent required to be sent in headers
      },
      auth: {
        username: github.cfg.username,
        password: github.cfg.password
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
  });
};
