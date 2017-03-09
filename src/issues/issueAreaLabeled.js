"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const areaLabels = require("../issues/areaLabels.js"); // map of area labels
const newComment = require("../issues/newComment.js"); // create comment

module.exports = exports = function(areaLabel, issueNumber, repoName, repoOwner, issueLabelArray) {
  if (!areaLabels.has(areaLabel)) return; // if added label isn't an area label, return;
  const areaLabelTeam = areaLabels.get(areaLabel); // find corresponding area label team
  github.issues.getComments({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber,
    per_page: 100
  }).then((issueComments) => {
    const labelComment = issueComments.data.find((issueComment) => {
      return issueComment.body.includes("this issue was labeled with the") && issueComment.user.login === "zulipbot";
    });
    if (labelComment) {
      let issueLabels = []; // initialize array for area labels
      let labelTeams = [];
      issueLabelArray.forEach((issueLabel) => {
        const labelName = issueLabel.name; // label name
        if (areaLabels.has(labelName) && !issueLabels.includes(labelName)) {
          issueLabels.push(labelName); // push all associated area labels to array
          labelTeams.push(areaLabels.get(labelName)); // push all associated area labels to array
        }
      }); // add all issue label names and area label teams to issueLabels to labelTeams
      const areaLabelTeams = labelTeams.join(`, @${repoOwner}/`);
      const referencedAreaLabels = issueLabels.join("\", \""); // join corresponding area label teams into one string
      let labelGrammar;
      if (labelTeams.length > 1) {
        labelGrammar = "labels";
      } else if (labelTeams.length === 1) {
        labelGrammar = "label";
      } else return;
      const comment = `Hello @${repoOwner}/${areaLabelTeams} members, this issue was labeled with the "${referencedAreaLabels}" ${labelGrammar}, so you may want to check it out!`; // comment template
      github.issues.editComment({
        owner: repoOwner,
        repo: repoName,
        id: labelComment.id,
        body: comment
      }).catch(console.error);
    } else {
      github.pullRequests.get({
        owner: repoOwner,
        repo: repoName,
        number: issueNumber
      }).then((response) => {
        const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this pull request was labeled with the **${areaLabel}** label, so you may want to check it out!`; // comment template
        if (response.data.title.includes("WIP") && comment.includes("@") && !comment.includes("Error")) return;
        newComment(repoOwner, repoName, issueNumber, comment); // create comment
      }, () => {
        const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this issue was labeled with the **${areaLabel}** label, so you may want to check it out!`; // comment template
        newComment(repoOwner, repoName, issueNumber, comment); // create comment
      });
    }
  });
};
