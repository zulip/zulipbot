"use strict"; // catch errors easier

const github = require("../github.js"); // GitHub wrapper initialization
const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  if (!body.match(/"(.*?)"/g)) return; // return if no parameters were specified
  let addedLabels = []; // initialize array for labels to be added to issue
  let rejectedLabels = []; // initialize array for rejected labels that don't exist
  let repoLabels = []; // initialize array for existing labels in repository
  github.issues.getLabels({
    owner: repoOwner,
    repo: repoName,
    per_page: 100 // if not specified, it only retrieves the first 30, creating some errors
  }).then((repoLabelArray) => {
    repoLabelArray.data.forEach(repoLabel => repoLabels.push(repoLabel.name));
    body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
      if (repoLabels.includes(label.replace(/"/g, ""))) {
        addedLabels.push(label.replace(/"/g, "")); // push each label that exists in repo to array of labels that should be added
      } else {
        rejectedLabels.push(label); // label doesn't exist in repository, reject it
      }
    });
    github.issues.addLabels({ // add labels
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      labels: addedLabels
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
      } else return;
      const rejectedLabelError = `**Error:** ${labelGrammar} ${rejectedLabelsString} ${doGrammar} not exist and ${wasGrammar} thus not added to this issue.`; // template literal comment
      newComment(repoOwner, repoName, issueNumber, rejectedLabelError); // post error comment
    });
  });
};
