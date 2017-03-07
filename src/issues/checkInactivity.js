"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const fs = require("fs"); // for reading welcome message
const inactiveWarning = fs.readFileSync("./src/issues/inactiveWarning.md", "utf8"); // get warning message contents
const newComment = require("./newComment.js"); // create comment
const abandonIssue = require("./abandonIssue.js"); // abandon issue

module.exports = exports = function() {
  github.issues.getAll({ // get all issues that are opened and labeled with "in progress", sort by oldest updated to newest updated
    filter: "all",
    state: "open",
    sort: "updated",
    labels: "in progress",
    direction: "asc",
    per_page: 100
  }).then((response) => {
    response.data.forEach((issue) => {
      const time = issue.updated_at; // timestamp of issue last updated
      const issueNumber = issue.number; // issue number
      const repoName = issue.repository.name; // repository name
      const repoOwner = issue.repository.owner.login; // respository owner
      let assignees = [];
      issue.assignees.forEach(assignee => assignees.push(assignee.login)); // issue assignees
      const assigneeString = assignees.join(", @"); // join array of assignees
      const comment = "Hello @" + assigneeString.concat(", ") + inactiveWarning; // body of comment
      if (Date.parse(time) + 604800000 <= Date.now()) { // if issue was not updated for 7 days
        github.issues.getComments({ // get comments of issue
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          per_page: 100
        }).then((issueComments) => {
          const labelComment = issueComments.data.find((issueComment) => {
            const timeLimit = Date.now() - 864000000 < Date.parse(issueComment.created_at) && Date.parse(issueComment.created_at) < Date.now(); // check if comment was made within last 10 days
            return issueComment.body.includes(comment) && timeLimit && issueComment.user.login === "zulipbot"; // find warning comment made by zulipbot within last 10 days
          });
          if (Date.parse(time) + 864000000 <= Date.now()) { // if 10 day time limit pased and not updated
            assignees.forEach((assignee) => {
              abandonIssue(assignee, issueNumber, repoName, repoOwner);
            });
            github.issues.removeLabel({ // remove "in progress" label
              owner: repoOwner,
              repo: repoName,
              number: issueNumber,
              name: "in progress"
            })
            .catch(console.error);
          } else if (!labelComment) { // if there was no warning comment made within last 10 days
            newComment(repoOwner, repoName, issueNumber, comment); // create comment
          }
        });
      }
    });
  });
};
