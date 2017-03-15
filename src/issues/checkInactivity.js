"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const fs = require("fs"); // for reading welcome message
const inactiveWarning = fs.readFileSync("./src/issues/inactiveWarning.md", "utf8"); // get warning message contents
const newComment = require("./newComment.js"); // create comment
const abandonIssue = require("./abandonIssue.js"); // abandon issue

module.exports = exports = function() {
  github.repos.getAll({ // get all repositories zulipbot is in
    per_page: 100
  }).then((response) => {
    let references = new Map(); // initialize map for PR references
    response.data.forEach((repo) => { // for each repository zulipbot is part of
      const repoName = repo.name; // repository name
      const repoOwner = repo.owner.login; // repository owner
      github.pullRequests.getAll({ // get last 100 updated PRs in each repository
        owner: repoOwner,
        repo: repoName,
        sort: "updated",
        direction: "desc",
        per_page: 100
      }).then((response) => {
        response.data.forEach((pullRequest) => { // for each PR in repository
          const body = pullRequest.body; // pull request body
          const time = Date.parse(pullRequest.updated_at); // when pull request was last updated
          if (!body.match(/#([0-9]+)/)) return; // return if it does not reference an issue
          const issueNumber = body.match(/#([0-9]+)/)[1]; // find first issue reference
          references.set(issueNumber, time); // push to map
        });
        scrapeInactiveIssues(references, repoOwner, repoName); // check inactive issues using references data
      });
    });
  });
};

function scrapeInactiveIssues(references, owner, name) {
  github.issues.getAll({ // get all issues that are opened and labeled with "in progress", sort by oldest updated to newest updated
    filter: "all",
    state: "open",
    sort: "updated",
    labels: "in progress",
    direction: "asc",
    per_page: 100
  }).then((response) => {
    response.data.forEach((issue) => {
      const time = Date.parse(issue.updated_at); // timestamp of issue last updated
      const issueNumber = issue.number; // issue number
      const repoName = issue.repository.name; // repository name
      const repoOwner = issue.repository.owner.login; // respository owner
      if (repoOwner !== owner || repoName !== name) return;
      let assignees = [];
      issue.assignees.forEach(assignee => assignees.push(assignee.login)); // issue assignees
      const assigneeString = assignees.join(", @"); // join array of assignees
      const comment = "Hello @" + assigneeString.concat(", ") + inactiveWarning; // body of comment
      const now = Date.now();
      if (time + 259200000 >= now) return; // if issue was not updated for 3 days
      github.issues.getComments({ // get comments of issue
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        per_page: 100
      }).then((issueComments) => {
        const labelComment = issueComments.data.find((issueComment) => {
          let commentTime = Date.parse(issueComment.created_at); // timestamp of the warning comment
          if (commentTime < references.get(issueNumber)) commentTime = references.get(issueNumber); // get the corresponding timestamp of the PR update
          const timeLimit = now - 864000000 < commentTime && commentTime - 259200000 < now; // check if comment was made between 10 days ago and 3 days ago
          return issueComment.body.includes(comment) && timeLimit && issueComment.user.login === "zulipbot"; // find warning comment made by zulipbot between 10 days ago and 3 days ago
        });
        if (labelComment && time + 259200000 <= now) { // if 3 day warning time limit pased and not updated
          assignees.forEach((assignee) => {
            abandonIssue(assignee, issueNumber, repoName, repoOwner); // remove each assignee
          });
          github.issues.removeLabel({ // remove "in progress" label
            owner: repoOwner,
            repo: repoName,
            number: issueNumber,
            name: "in progress"
          })
          .catch(console.error);
        } else if (!labelComment && time + 604800000 <= now) { // if there was no warning comment made within last 7 days
          newComment(repoOwner, repoName, issueNumber, comment); // create comment
        }
      });
    });
  });
}
