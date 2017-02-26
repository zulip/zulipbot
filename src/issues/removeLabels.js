const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("../config.js"); // hidden config file

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(body, issueNumber, repoName, repoOwner) {
  if (!body.match(/"(.*?)"/g)) return;
  let rejectedLabels = []; // initialize array for rejected labels
  let issueLabels = [];
  github.issues.getIssueLabels({
    owner: repoOwner,
    repo: repoName,
    number: issueNumber
  }).then((issueLabelArray) => {
    issueLabelArray.forEach((issueLabel) => {
      issueLabels.push(issueLabel.name);
    });
    body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
      if (issueLabels.includes(label.replace(/"/g, ""))) {
        issueLabels.splice(issueLabels.indexOf(label.replace(/"/g, "")), 1);
      } else {
        rejectedLabels.push(label);
      }
    });
    github.issues.replaceAllLabels({ // replace labels without removed labels
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      labels: issueLabels
    })
    .catch(console.error)
    .then((response) => {
      const rejectedLabelsString = rejectedLabels.join(', ');
      let labelGrammar, doGrammar, wasGrammar;
      if (rejectedLabels.length > 1) {
        labelGrammar = 'Labels';
        doGrammar = 'do'
        wasGrammar = 'were';
      } else if (rejectedLabels.length === 1) {
        labelGrammar = 'Label';
        doGrammar = 'does'
        wasGrammar = 'was';
      } else {
        return;
      }
      const rejectedLabelError = `**Error:** ${labelGrammar} ${rejectedLabelsString} ${doGrammar} not exist and ${wasGrammar} thus not removed from this issue.`;
      github.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        body: rejectedLabelError
      })
      .catch(console.error)
    });
  });
}
