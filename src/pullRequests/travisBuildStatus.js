"use strict"; // catch errors easier

const newComment = require("../issues/newComment.js"); // create comment

module.exports = exports = function(client, state, repoOwner, repoName, pullRequestNumber, buildURL) {
  let comment = "(unknown state)";
  if (state === "passed") {
    comment = `Congratulations, the Travis [builds](${buildURL}) for this pull request **${state}**!`;
  } else if (state === "failed" || "errored") {
    comment = `Oh no, something went wrong: the Travis builds for this pull request **${state}**! Review the [build logs](${buildURL}) for more details.`;
  }
  let labelCheck;
  client.issues.getIssueLabels({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((labels) => {
    labelCheck = labels.data.find((label) => {
      return label.name === client.cfg.travisLabel;
    });
    if (labelCheck) newComment(client, repoOwner, repoName, pullRequestNumber, comment);
  });
};
