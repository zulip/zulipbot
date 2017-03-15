"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const issueReferenced = require("../pullRequests/issueReferenced.js"); // check referenced issues

module.exports = exports = function(body, pullRequestNumber, repoName, repoOwner) {
  github.pullRequests.getCommits({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((response) => {
    response.data.forEach((pullRequest) => {
      const message = pullRequest.commit.message.split("\n\n")[1];
      if (!message) return;
      if (message.match(/#([0-9]+)/)) issueReferenced(message, pullRequestNumber, repoName, repoOwner);
    });
  });
};
