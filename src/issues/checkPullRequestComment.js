"use strict"; // catch errors easier

const issueReferenced = require("../pullRequests/issueReferenced.js"); // create comment

module.exports = exports = function(github, body, issueNumber, repoName, repoOwner) {
  github.pullRequests.get({ // check if issue was referenced on a PR
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    issueReferenced(github, body, issueNumber, repoName, repoOwner); // pull-request-to-issue reference
  });
};
