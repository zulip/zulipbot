"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const areaLabels = require("./areaLabels.js"); // map of area labels
const newComment = require("./newComment.js"); // create comment

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(areaLabel, issueNumber, repoName, repoOwner) {
  if (!areaLabels.has(areaLabel)) return; // if added label isn't an area label, return;
  const areaLabelTeam = areaLabels.get(areaLabel); // find corresponding area label team
  const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this issue needs your attention!`; // comment template
  newComment(repoOwner, repoName, issueNumber, comment); // create comment
};
