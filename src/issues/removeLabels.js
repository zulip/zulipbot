"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(body, issueNumber, repoName, repoOwner, issueLabelArray) {
  if (!body.match(/"(.*?)"/g)) return; // return if no parameters were specified
  let rejectedLabels = []; // initialize array for rejected labels that don't exist
  let issueLabels = []; // initialize array for labels that won't be removed
  let removedLabels = []; // initialize array for labels that are removed
  issueLabelArray.forEach(issueLabel => issueLabels.push(issueLabel.name)); // add all issue label names to issueLabels
  body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
    if (issueLabels.includes(label.replace(/"/g, ""))) { // check if content between quotes is a label on issue
      issueLabels.splice(issueLabels.indexOf(label.replace(/"/g, "")), 1); // label was specified to be deleted, make sure it doesn't get added back
      removedLabels.push(label);
    } else if (!removedLabels.includes(label)) {
      rejectedLabels.push(label); // specified label doesn't exist and wasn't removed, reject it
    }
  });
  github.issues.replaceAllLabels({ // replace labels without removed labels
    owner: repoOwner,
    repo: repoName,
    number: issueNumber,
    labels: issueLabels
  })
  .catch(console.error)
  .then(() => {
    const rejectedLabelsString = rejectedLabels.join(", "); // joins all elements in rejectedLabels array
    let labelGrammar, doGrammar, wasGrammar; // initialize grammar variables
    if (rejectedLabels.length > 1) { // more than one label (plural)
      labelGrammar = "Labels";
      doGrammar = "do";
      wasGrammar = "were";
    } else if (rejectedLabels.length === 1) { // one label (singular)
      labelGrammar = "Label";
      doGrammar = "does";
      wasGrammar = "was";
    } else return; // no rejected labels
    const rejectedLabelError = `**Error:** ${labelGrammar} ${rejectedLabelsString} ${doGrammar} not exist and ${wasGrammar} thus not removed from this issue.`; // template literal comment
    newComment(repoOwner, repoName, issueNumber, rejectedLabelError); // post error comment
  });
};
