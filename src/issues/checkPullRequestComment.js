"use strict"; // catch errors easier

const issueReferenced = require("../pullRequests/issueReferenced.js"); // create comment

module.exports = exports = function(client, body, issueNumber, repoName, repoOwner) {
  client.pullRequests.get({ // check if issue was referenced on a PR
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    issueReferenced(client, body, issueNumber, repoName, repoOwner); // pull-request-to-issue reference
  });
};
