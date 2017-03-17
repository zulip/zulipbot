"use strict";

const github = require("../github.js"); // GitHub wrapper initialization
const cfg = require("../config.js"); // hidden config file
const newComment = require("./newComment.js"); // create comment

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
      if (cfg.areaLabels.has(labelString)) {
        joinedTeams.push(cfg.areaLabels.get(labelString));
        teamIDs.push(labelTeams.get(cfg.areaLabels.get(labelString)));
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
