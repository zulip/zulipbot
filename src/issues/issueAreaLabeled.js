"use strict"; // catch errors easier

const newComment = require("../issues/newComment.js"); // create comment
let referencedIssues = [];

module.exports = exports = function(github, areaLabel, issueNumber, repoName, repoOwner, issueLabelArray) {
  if (!github.cfg.areaLabels.has(areaLabel)) return; // if added label isn't an area label, return;
  github.issues.getComments({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber,
    per_page: 100
  }).then((issueComments) => {
    let issueLabels = []; // initialize array for area labels
    let labelTeams = [];
    issueLabelArray.forEach((issueLabel) => {
      const labelName = issueLabel.name; // label name
      if (github.cfg.areaLabels.has(labelName) && !issueLabels.includes(labelName)) {
        issueLabels.push(labelName); // push all associated area labels to array
        labelTeams.push(github.cfg.areaLabels.get(labelName)); // push all associated area labels to array
      }
    }); // add all issue label names and area label teams to issueLabels to labelTeams
    const areaLabelTeams = labelTeams.join(`, @${repoOwner}/`);
    const referencedAreaLabels = issueLabels.join("**, **"); // join corresponding area label teams into one string
    let labelGrammar;
    if (labelTeams.length > 1) {
      labelGrammar = "labels";
    } else if (labelTeams.length === 1) {
      labelGrammar = "label";
    } else return;
    const comment = `Hello @${repoOwner}/${areaLabelTeams} members, this issue was labeled with the **${referencedAreaLabels}** ${labelGrammar}, so you may want to check it out!`; // comment template
    const labelComment = issueComments.data.find((issueComment) => {
      return issueComment.body.includes("this issue was labeled with the") && issueComment.user.login === github.cfg.username;
    });
    if (labelComment) {
      github.issues.editComment({
        owner: repoOwner,
        repo: repoName,
        id: labelComment.id,
        body: comment
      }).catch(console.error);
    } else {
      if (referencedIssues.includes(issueNumber)) return;
      newComment(github, repoOwner, repoName, issueNumber, comment); // create comment
      referencedIssues.push(issueNumber);
      setTimeout(() => {
        referencedIssues.splice(referencedIssues.indexOf(issueNumber), 1);
      }, 1000);
    }
  });
};
