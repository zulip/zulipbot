"use strict"; // catch errors easier

const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  if (!body.match(/"(.*?)"/g)) return; // return if no parameters were specified
  let rejectedLabels = []; // initialize array for rejected labels that don't exist
  let issueLabels = []; // initialize array for labels that won't be removed
  github.issues.getIssueLabels({ // get previous issue labels
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((issueLabelArray) => {
    issueLabelArray.forEach(issueLabel => issueLabels.push(issueLabel.name)); // add all issue label names to issueLabels
    body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
      if (issueLabels.includes(label.replace(/"/g, ""))) { // check if content between quotes is a label on issue
        issueLabels.splice(issueLabels.indexOf(label.replace(/"/g, "")), 1); // label was specified to be deleted, make sure it doesn't get added back
      } else {
        rejectedLabels.push(label); // specified label doesn't exist, reject it
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
      github.issues.createComment({ // post error comment
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        body: rejectedLabelError
      })
      .catch(console.error);
    });
  });
};
