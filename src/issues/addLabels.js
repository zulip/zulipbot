"use strict"; // catch errors easier

const newComment = require("./newComment.js"); // create comment

module.exports = exports = function(client, body, issueNumber, repoName, repoOwner, issueLabelArray) {
  if (!body.match(/"(.*?)"/g)) return; // return if no parameters were specified
  let addedLabels = []; // initialize array for labels to be added to issue
  let rejectedLabels = []; // initialize array for rejected labels that don't exist
  let repoLabels = []; // initialize array for existing labels in repository
  let issueLabels = []; // initialize array for existing labels in issue
  let alreadyAdded = []; // initialize array for labels that have already been added
  client.issues.getLabels({
    owner: repoOwner,
    repo: repoName,
    per_page: 100 // if not specified, it only retrieves the first 30, creating some errors
  }).then((repoLabelArray) => {
    repoLabelArray.data.forEach(repoLabel => repoLabels.push(repoLabel.name));
    issueLabelArray.forEach(issueLabel => issueLabels.push(issueLabel.name)); // add all issue label names to issueLabels
    body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
      if (issueLabels.includes(label.replace(/"/g, ""))) {
        alreadyAdded.push(label); // push label to array of already added if label exists in issue already
      } else if (repoLabels.includes(label.replace(/"/g, ""))) {
        addedLabels.push(label.replace(/"/g, "")); // push each label that exists in repo and not already in issue to array of labels that should be added
      } else {
        rejectedLabels.push(label); // label doesn't exist in repository, reject it
      }
    });
    client.issues.addLabels({ // add labels
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      labels: addedLabels
    })
    .catch(console.error)
    .then(() => {
      const rejectedLabelsString = rejectedLabels.join(", "); // joins all elements in rejectedLabels array
      let printRejected = true; // initialize print rejected labels to true
      let labelGrammar, doGrammar, wasGrammar; // initialize grammar variables
      if (rejectedLabels.length > 1) { // more than one label (plural)
        labelGrammar = "Labels";
        doGrammar = "do";
        wasGrammar = "were";
      } else if (rejectedLabels.length === 1) { // one label (singular)
        labelGrammar = "Label";
        doGrammar = "does";
        wasGrammar = "was";
      } else printRejected = false; // when there are no rejected labels
      const rejectedLabelError = `**Error:** ${labelGrammar} ${rejectedLabelsString} ${doGrammar} not exist and ${wasGrammar} thus not added to this issue.`; // template literal comment
      if (printRejected) newComment(client, repoOwner, repoName, issueNumber, rejectedLabelError); // post error comment
      const alreadyAddedString = alreadyAdded.join(", "); // joins all elements in alreadyAdded array
      let printAlreadyAdded = true; // initialize print already added labels to true
      let existGrammar; // initialize grammar variables
      if (alreadyAdded.length > 1) { // more than one label (plural)
        labelGrammar = "Labels";
        existGrammar = "exist";
        wasGrammar = "were";
      } else if (alreadyAdded.length === 1) { // one label (singular)
        labelGrammar = "Label";
        existGrammar = "exists";
        wasGrammar = "was";
      } else printAlreadyAdded = false; // when there are no already added labels
      const alreadyAddedError = `**Error:** ${labelGrammar} ${alreadyAddedString} already ${existGrammar} and ${wasGrammar} thus not added again to this issue.`; // template literal comment
      if (printAlreadyAdded) newComment(client, repoOwner, repoName, issueNumber, alreadyAddedError); // post error comment
    });
  });
};
