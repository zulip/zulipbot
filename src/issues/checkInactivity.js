"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const cfg = require("../config.js"); // config file
const fs = require("fs"); // for reading welcome message
const inactiveWarning = fs.readFileSync("./src/templates/inactiveWarning.md", "utf8"); // get warning message contents
const updateWarning = fs.readFileSync("./src/templates/updateWarning.md", "utf8"); // get update message contents
const needsReviewWarning = fs.readFileSync("./src/templates/needsReviewWarning.md", "utf8"); // get update message contents
const abandonWarning = fs.readFileSync("./src/templates/abandonWarning.md", "utf8"); // get update message contents
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
          const inactiveLabel = pullRequest.labels.find((label) => {
            return label.name === cfg.inactiveLabel;
          });
          if (inactiveLabel) return;
          const body = pullRequest.body; // pull request body
          const time = Date.parse(pullRequest.updated_at); // when pull request was last updated
          const number = pullRequest.number;
          const author = pullRequest.user.login;
          let pullRequestAssignees = [];
          pullRequestAssignees.forEach(assignee => pullRequestAssignees.push(assignee.login)); // pull request assignees
          let labels = [];
          github.issues.getIssueLabels({
            owner: repoOwner,
            repo: repoName,
            number: number
          }).then((response) => {
            response.data.forEach(label => labels.push(label.name));
            if (time + cfg.inactivityTimeLimit * 1000 >= Date.now()) return; // if pull request was not updated for 7 days
            const reviewedLabel = labels.find((label) => {
              return label.name === cfg.reviewedLabel;
            });
            const needsReviewLabel = labels.find((label) => {
              return label.name === cfg.needsReviewLabel;
            });
            if (reviewedLabel) {
              newComment(repoOwner, repoName, number, updateWarning.replace("[author]", author)); // create comment
            } else if (needsReviewLabel) {
              newComment(repoOwner, repoName, number, needsReviewWarning.replace("[assignees], @[author]", pullRequestAssignees.join(", @").concat(`, @${author}`))); // create comment
            }
            if (!body.match(/#([0-9]+)/)) return; // return if it does not reference an issue
            const issueNumber = body.match(/#([0-9]+)/)[1]; // find first issue reference
            references.set(issueNumber, time); // push to map
          });
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
    labels: cfg.inProgressLabel,
    direction: "asc",
    per_page: 100
  }).then((response) => {
    response.data.forEach((issue) => {
      const inactiveLabel = issue.labels.find((label) => {
        return label.name === cfg.inactiveLabel;
      });
      if (inactiveLabel) return;
      let time = Date.parse(issue.updated_at); // timestamp of issue last updated
      const issueNumber = issue.number; // issue number
      if (time < references.get(issueNumber)) time = references.get(issueNumber); // get the corresponding timestamp of the PR update
      const repoName = issue.repository.name; // repository name
      const repoOwner = issue.repository.owner.login; // respository owner
      if (repoOwner !== owner || repoName !== name) return;
      let assignees = [];
      issue.assignees.forEach(assignee => assignees.push(assignee.login)); // issue assignees
      const assigneeString = assignees.join(", @"); // join array of assignees
      const comment = inactiveWarning.replace("[assignee]", assigneeString); // body of comment
      const now = Date.now();
      if (time + cfg.autoAbandonTimeLimit * 1000 >= now) return; // if issue was not updated for 3 days
      github.issues.getComments({ // get comments of issue
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        per_page: 100
      }).then((issueComments) => {
        const labelComment = issueComments.data.find((issueComment) => {
          const commentTime = Date.parse(issueComment.created_at); // timestamp of the warning comment
          const timeLimit = now - (cfg.autoAbandonTimeLimit * 1000 + cfg.inactivityTimeLimit * 1000) < commentTime && commentTime - cfg.autoAbandonTimeLimit * 1000 < now; // check if comment was made between 10 days ago and 3 days ago
          return issueComment.body.includes(comment) && timeLimit && issueComment.user.login === cfg.username; // find warning comment made by zulipbot between 10 days ago and 3 days ago
        });
        if (labelComment && time + cfg.autoAbandonTimeLimit * 1000 <= now) { // if 3 day warning time limit pased and not updated
          assignees.forEach((assignee) => {
            abandonIssue(assignee, issueNumber, repoName, repoOwner); // remove each assignee
          });
          if (cfg.inProgressLabel) github.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: cfg.inProgressLabel}).catch(console.error); // remove "in progress" label
          newComment(repoOwner, repoName, issueNumber, abandonWarning.replace("[assignee]", assigneeString)); // create comment
        } else if (!labelComment && time + cfg.inactivityTimeLimit * 1000 <= now) { // if there was no warning comment made within last 7 days
          newComment(repoOwner, repoName, issueNumber, comment); // create comment
        }
      });
    });
  });
}
