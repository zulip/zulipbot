"use strict"; // catch errors easier

const issueReferenced = require("../pullRequests/issueReferenced.js"); // check referenced issues

module.exports = exports = (client, body, pullRequestNumber, repoName, repoOwner) => {
  client.pullRequests.getCommits({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((response) => {
    let multipleReferences = [];
    response.data.forEach((pullRequest) => {
      const message = pullRequest.commit.message;
      if (!message) return;
      const reference = message.match(/#([0-9]+)/);
      if (!reference) return;
      if (!multipleReferences.includes(reference[1])) {
        issueReferenced(client, message, pullRequestNumber, repoName, repoOwner);
        multipleReferences.push(reference[1]);
      }
    });
  });
};
