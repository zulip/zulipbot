const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
const cfg = require("./config.js"); // hidden config file

github.authenticate({ // Authentication
  type: "basic",
  username: cfg.username,
  password: cfg.password
});

module.exports = exports = function(payload) {
  // get necessary information from request body
  let commenter, body;
  if (payload.action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (payload.action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  }
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  if (body.includes("@zulipbot claim")) { // check body content for "@zulipbot claim"
    claimIssue(commenter, body, issueNumber, repoName, repoOwner);
  }
  if (body.includes("@zulipbot label") && commenter === issueCreator) { // check bodycontent for "@zulipbot label and ensure commenter opened the issue
    addLabels(body, issueNumber, repoName, repoOwner);
  }
  if (body.includes("@zulipbot remove") && commenter === issueCreator) { // check bodycontent for "@zulipbot remove" and ensure commenter opened the issue
    removeLabels(body, issueNumber, repoName, repoOwner);
  }
}

function addLabels(body, issueNumber, repoName, repoOwner) {
  let labels = []; // initialize array for labels to be added to issue
  body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
    labels.push(label.replace(/"/g, "")); // push each element to labels array
  });
  github.issues.addLabels({ // add labels
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      labels: labels
    })
    .catch(console.error)
}

function removeLabels(body, issueNumber, repoName, repoOwner) {
  let labels = []; // initialize array for labels to be removed from issue
  body.match(/"(.*?)"/g).forEach((label) => { // global regex search for content between double quotes ("")
    labels.push(label.replace(/"/g, "")); // push each element to labels array
  });
  labels.forEach((label) => { // remove labels
    github.issues.removeLabel({
      owner: repoOwner,
      repo: repoName,
      number: issueNumber,
      name: label
    })
    .catch(console.error)
  });
}

function claimIssue(commenter, body, issueNumber, repoName, repoOwner) {
  const issue_labels = ["in progress"]; // create array for new issue labels
  const issue_assignees = [commenter]; // create array for new assignees
  github.repos.checkCollaborator({ // check if commenter is a collaborator
      owner: repoOwner,
      repo: repoName,
      username: commenter
    })
    .catch( // if commenter is not collaborator
      github.repos.addCollaborator({ // give commenter read-only (pull) access
        owner: repoOwner,
        repo: repoName,
        username: commenter,
        permission: "pull"
      })
      .catch(console.error)
      .then(
        github.issues.addAssigneesToIssue({ // add assignee
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          assignees: issue_assignees
        })
        .catch(console.error)
      )
    )
    .then(
      github.issues.addAssigneesToIssue({ // add assignee
        owner: repoOwner,
        repo: repoName,
        number: issueNumber,
        assignees: issue_assignees
      })
      .catch(console.error)
      .then(
        github.issues.addLabels({ // add labels
          owner: repoOwner,
          repo: repoName,
          number: issueNumber,
          labels: issue_labels
        })
        .catch(console.error)
      )
    )
}
