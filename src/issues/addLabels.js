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
  let addedLabels = []; // initialize array for labels to be added to issue
  let rejectedLabels = [];
  let repoLabels = [];
  github.issues.getLabels({
    owner: repoOwner,
    repo: repoName,
    per_page: 100
  }).then((repoLabelArray) => {
    repoLabelArray.forEach((repoLabel) => {
      repoLabels.push(repoLabel.name);
    })
    body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
      if (repoLabels.includes(label.replace(/"/g, ""))) {
        addedLabels.push(label.replace(/"/g, "")); // push each element to labels array
      } else {
        rejectedLabels.push(label);
      }
    });
    github.issues.addLabels({ // add labels
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        labels: addedLabels
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
        const rejectedLabelError = `**Error:** ${labelGrammar} ${rejectedLabelsString} ${doGrammar} not exist and ${wasGrammar} thus not added to this issue.`;
        github.issues.createComment({
            owner: repoOwner,
            repo: repoName,
            number: issueNumber,
            body: rejectedLabelError
          })
          .catch(console.error)
      });
  })
}
