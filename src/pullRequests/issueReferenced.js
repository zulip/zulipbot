"use strict"; // catch errors easier

const newComment = require("../issues/newComment.js"); // create comment
const fs = require("fs"); // for reading messages
const fixCommitMessage = fs.readFileSync("./src/templates/fixCommitMessage.md", "utf8"); // get fix commit message contents

module.exports = exports = function(github, body, pullRequestNumber, repoName, repoOwner) {
  const referencedIssueNumber = body.match(/#([0-9]+)/)[1];
  let issueLabels = []; // initialize array for area labels
  let labelTeams = [];
  let mentionedLabels = [];
  github.pullRequests.getCommits({
    owner: repoOwner,
    repo: repoName,
    number: pullRequestNumber
  }).then((response) => {
    let referencedIssue = false;
    let commitAuthor = "";
    response.data.forEach((commit) => {
      const message = commit.commit.message;
      if (commit.author) commitAuthor = commit.author.login;
      if (!message) return;
      if (message.match(/#([0-9]+)/) && message.match(/#([0-9]+)/)[1] === referencedIssueNumber) referencedIssue = true;
    });
    if (!referencedIssue) newComment(github, repoOwner, repoName, pullRequestNumber, fixCommitMessage.replace("[author]", commitAuthor));
    github.issues.getComments({ // get comments of issue
      owner: repoOwner,
      repo: repoName,
      number: pullRequestNumber,
      per_page: 100
    }).then((pullComments) => {
      if (pullComments.data.length) {
        pullComments.data.forEach((pullComment) => {
          if (pullComment.body.includes("this pull request references") && pullComment.user.login === github.cfg.username) {
            mentionedLabels = mentionedLabels.concat(pullComment.body.match(/"(.*?)"/g));
          }
        });
      }
      github.issues.getIssueLabels({ // get referenced issue labels
        owner: repoOwner,
        repo: repoName,
        number: referencedIssueNumber
      }).then((issueLabelArray) => {
        issueLabelArray.data.forEach((issueLabel) => {
          const labelName = issueLabel.name; // label name
          if (github.cfg.areaLabels.has(labelName) && !issueLabels.includes(labelName) && !mentionedLabels.includes("\"" + labelName + "\"")) { // make sure the label team hasn't been mentioned yet
            issueLabels.push(labelName); // push all associated area labels to array
            labelTeams.push(github.cfg.areaLabels.get(labelName)); // push all associated area labels to array
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
        const comment = `Hello @${repoOwner}/${areaLabelTeams} members, this pull request references an issue with the "${referencedAreaLabels}" ${labelGrammar}, so you may want to check it out!`; // comment template
        newComment(github, repoOwner, repoName, pullRequestNumber, comment); // create comment
      });
    });
  });
};
