const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file
const areaLabels = require("./areaLabels.js"); // map of area labels
const newComment = require("./newComment.js"); // create comment

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  const referencedIssueNumber = body.match(/#([0-9]+)/)[1];
  github.pullRequests.get({ // check if issue was referenced on a PR
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then(() => {
    getIssueLabels(referencedIssueNumber, issueNumber, repoName, repoOwner);
  }, () => {
    return; // escape issue-to-issue references
  });
};

function getIssueLabels(referencedIssueNumber, issueNumber, repoName, repoOwner) {
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
      const comment = `Hello @${repoOwner}/${areaLabelTeam} members, this pull request needs your attention!`; // comment template
      newComment(repoOwner, repoName, issueNumber, comment); // create comment
    });
  });
}
