"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const areaLabels = require("../issues/areaLabels.js"); // map of area labels
const newComment = require("../issues/newComment.js"); // create comment

module.exports = exports = function(body, pullRequestNumber, repoName, repoOwner) {
  const referencedIssueNumber = body.match(/#([0-9]+)/)[1];
  let issueLabels = []; // initialize array for area labels
  github.issues.getIssueLabels({ // get referenced issue labels
    owner: repoOwner,
    repo: repoName,
    number: referencedIssueNumber
  }).then((issueLabelArray) => {
    issueLabelArray.data.forEach((issueLabel) => {
      const labelName = issueLabel.name; // label name
      if (areaLabels.has(labelName) && !issueLabels.includes(labelName)) issueLabels.push(labelName); // push all associated area labels to array
    }); // add all issue label names to issueLabels
    issueLabels.forEach((areaLabel) => { // for each area label on issue (there are multiple on some)
      const areaLabelTeam = areaLabels.get(areaLabel); // find corresponding area label team
      const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this pull request references an issue with the **${areaLabel}** label, so you may want to check it out!`; // comment template
      newComment(repoOwner, repoName, pullRequestNumber, comment); // create comment
    });
  });
};
