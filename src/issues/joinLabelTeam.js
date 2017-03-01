"use strict";

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const areaLabels = require("./areaLabels.js");
const newComment = require("./newComment.js"); // create comment

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(body, commenter, repoOwner, repoName, issueNumber) {
  if (!body.match(/"(.*?)"/g)) return;
  let labelTeams = new Map();
  let joinedTeams = [];
  let teamIDs = [];
  github.orgs.getTeams({
    org: repoOwner
  }).then((teams) => {
    teams.forEach((team) => {
      labelTeams.set(team.slug, team.id);
    });
    body.match(/"(.*?)"/g).forEach((label) => {
      let labelString = label.replace(/"/g, "");
      if (areaLabels.has(labelString)) {
        joinedTeams.push(areaLabels.get(labelString));
        teamIDs.push(labelTeams.get(areaLabels.get(labelString)));
      }
    });
    teamIDs.forEach((teamID) => {
      github.orgs.getTeamMembership({
        id: teamID,
        username: commenter
      }).then(
        () => {
          joinedTeams.pop();
        },
        () => {
          github.orgs.addTeamMembership({
            id: teamID,
            username: commenter
          });
        });
    });
    const joinedTeamsString = joinedTeams.join(`**, **${repoOwner}/`);
    if (!joinedTeamsString) return;
    github.orgs.checkMembership({
      org: repoOwner,
      username: commenter
    })
    .then((response) => {
      if (response.meta.status === "204 No Content") {
        let teamGrammar = "team";
        if (joinedTeams.length > 1) teamGrammar = "teams";
        newComment(repoOwner, repoName, issueNumber, `Congratulations @${commenter}, you successfully joined ${teamGrammar} **${repoOwner}/${joinedTeamsString}**!`);
      }
    }, (response) => {
      if (response.headers.status === "404 Not Found") {
        let invitationGrammar = "invitation";
        if (joinedTeams.length > 1) invitationGrammar = "invitations";
        newComment(repoOwner, repoName, issueNumber, `Hello @${commenter}, please check your email for an organization invitation or visit https://github.com/orgs/${repoOwner}/invitation in order to accept your team ${invitationGrammar}!`);
      }
    });
  });
};
