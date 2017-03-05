"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const newComment = require("../issues/newComment.js"); // create comment

module.exports = exports = function(response) {
  const payload = JSON.parse(response);
  if (!payload.pull_request) return;
  const state = payload.state;
  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const pullRequestNumber = payload.pull_request_number.toString();
  const buildURL = payload.build_url;
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
      return label.name === "travis updates";
    });
    if (labelCheck) newComment(repoOwner, repoName, pullRequestNumber, comment);
  });
};
