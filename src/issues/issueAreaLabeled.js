"use strict"; // catch errors easier

const areaLabels = require("./areaLabels.js"); // map of area labels
const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(areaLabel, issueNumber, repoName, repoOwner) {
  if (!areaLabels.has(areaLabel)) return; // if added label isn't an area label, return;
  const areaLabelTeam = areaLabels.get(areaLabel); // find corresponding area label team
  const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this issue was labeled with the **${areaLabel}** label, so you may want to check it out!`; // comment template
  newComment(repoOwner, repoName, issueNumber, comment); // create comment
};
