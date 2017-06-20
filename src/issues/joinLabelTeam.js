"use strict";

const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(client, body, commenter, repoOwner, repoName, issueNumber) {
  if (!body.match(/"(.*?)"/g)) return;
  let labelTeams = new Map();
  let joinedTeams = [];
  let teamIDs = [];
  client.orgs.getTeams({
    org: repoOwner
  }).then((teams) => {
    teams.forEach((team) => {
      labelTeams.set(team.slug, team.id);
    });
    body.match(/"(.*?)"/g).forEach((label) => {
      let labelString = label.replace(/"/g, "");
      if (client.cfg.areaLabels.has(labelString)) {
        joinedTeams.push(client.cfg.areaLabels.get(labelString));
        teamIDs.push(labelTeams.get(client.cfg.areaLabels.get(labelString)));
      }
    });
    teamIDs.forEach((teamID) => {
      client.orgs.getTeamMembership({
        id: teamID,
        username: commenter
      }).then(
        () => {
          joinedTeams.pop();
        },
        () => {
          client.orgs.addTeamMembership({
            id: teamID,
            username: commenter
          });
        });
    });
    const joinedTeamsString = joinedTeams.join(`**, **${repoOwner}/`);
    if (!joinedTeamsString) return;
    client.orgs.checkMembership({
      org: repoOwner,
      username: commenter
    })
    .then((response) => {
      if (response.meta.status === "204 No Content") {
        let teamGrammar = "team";
        if (joinedTeams.length > 1) teamGrammar = "teams";
        newComment(client, repoOwner, repoName, issueNumber, `Congratulations @${commenter}, you successfully joined ${teamGrammar} **${repoOwner}/${joinedTeamsString}**!`);
      }
    }, (response) => {
      if (response.headers.status === "404 Not Found") {
        let invitationGrammar = "invitation";
        if (joinedTeams.length > 1) invitationGrammar = "invitations";
        newComment(client, repoOwner, repoName, issueNumber, `Hello @${commenter}, please check your email for an organization invitation or visit https://github.com/orgs/${repoOwner}/invitation in order to accept your team ${invitationGrammar}!`);
      }
    });
  });
};
