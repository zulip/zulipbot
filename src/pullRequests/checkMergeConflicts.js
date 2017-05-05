"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const cfg = require("../config.js"); // config file
const newComment = require("../issues/newComment.js"); // create comment
const fs = require("fs"); // for reading messages
const mergeConflictWarning = fs.readFileSync("./src/templates/mergeConflictWarning.md", "utf8"); // get merge conflict warning contents

module.exports = exports = function(payload) {
  if (payload.ref !== "refs/heads/master") return; // break if push wasn't towards master branch
  const repoName = payload.repository.name; // PR repository
  const repoOwner = payload.repository.owner.login; // repository owner
  const commit = payload.head_commit.id;
  github.pullRequests.getAll({
    owner: repoOwner,
    repo: repoName,
    sort: "updated",
    direction: "desc"
  }).then((pullRequests) => {
    pullRequests.data.forEach((pullRequest) => {
      const pullRequestNumber = pullRequest.number;
      github.pullRequests.get({
        owner: repoOwner,
        repo: repoName,
        number: pullRequestNumber
      }).then((pull) => {
        const mergeable = pull.data.mergeable;
        const author = pull.data.user.login;
        const comment = mergeConflictWarning.replace("[username]", author).replace("[commit]", commit).replace("[repoOwner]", repoOwner).replace("[repoName]", repoName);
        github.pullRequests.getCommits({ // get commits of issue
          owner: repoOwner,
          repo: repoName,
          number: pullRequestNumber,
          per_page: 100
        }).then((commits) => {
          const lastCommitTime = Date.parse(commits.data.slice(-1).pop().commit.committer.date); // get timestamp of latest commit
          github.issues.getComments({ // get comments of issue
            owner: repoOwner,
            repo: repoName,
            number: pullRequestNumber,
            per_page: 100
          }).then((issueComments) => {
            const labelComment = issueComments.data.find((issueComment) => {
              const synchCheck = lastCommitTime < Date.parse(issueComment.updated_at); // check if warning comment was posted after most recent commit
              return issueComment.body.includes(comment.substring(0, 25)) && synchCheck && issueComment.user.login === cfg.username; // find warning comment made after most recent commit by zulipbot
            });
            if (!labelComment && mergeable === false) newComment(repoOwner, repoName, pullRequestNumber, comment); // post only if there's no comment after most recent commit, use === to avoid triggering alert for null values
          });
        });
      });
    });
  });
};
