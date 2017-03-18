"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const newComment = require("../issues/newComment.js"); // create comment
const cfg = require("../config.js"); // config file

module.exports = exports = function(state, repoOwner, repoName, pullRequestNumber, buildURL) {
  let comment = "(unknown state)";
  if (state === "passed") {
    comment = `Congratulations, the Travis [builds](${buildURL}) for this pull request **${state}**!`;
  } else if (state === "failed" || "errored") {
    comment = `Oh no, something went wrong: the Travis builds for this pull request **${state}**! Review the [build logs](${buildURL}) for more details.`;
  }
  let labelCheck;
  github.issues.getIssueLabels({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((labels) => {
    labelCheck = labels.data.find((label) => {
      return label.name === cfg.travisLabel;
    });
    if (labelCheck) newComment(repoOwner, repoName, pullRequestNumber, comment);
  });
};
