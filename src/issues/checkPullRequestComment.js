"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const issueReferenced = require("../pullRequests/issueReferenced.js"); // create comment

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  github.pullRequests.get({ // check if issue was referenced on a PR
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    issueReferenced(body, issueNumber, repoName, repoOwner); // pull-request-to-issue reference
  });
};
