// Requirements
const GitHubApi = require("github");
const http = require('http')
const express = require('express');
const bodyParser = require('body-parser');
const cfg = require('./config.js'); // hidden config file

// Server
const app = express();
const port = process.env.PORT || 8080;

app.listen(port, function() {
  console.log('Website is running on http://localhost:' + port);
});

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  res.redirect("https://github.com/zulip/zulipbot");
});

// Parse JSON
app.use(bodyParser.json());

// Handle POST requests
app.post('/', function(req, res) {
  res.render('index'); // Send contents of index.ejs
  const github = new GitHubApi(); // API client
  github.authenticate({ // Authentication
    type: "basic",
    username: cfg.username,
    password: cfg.password
  });
  if (req.get("X-GitHub-Event").includes("issue")) { // check if event is issue-related (issues or issue_comment)
    // get necessary information from request body
    let commenter, body;
    if (req.body.action === "opened") { // if issue was opened
      commenter = req.body.issue.user.login; // issue creator's username
      body = req.body.issue.body; // contents of issue body
    } else if (req.body.action === "created") { // if issue comment was created
      commenter = req.body.comment.user.login; // commenter's username
      body = req.body.comment.body; // contents of issue comment
    } else {
      return; // break if not one of the previous events
    }
    let issue_number = req.body.issue.number; // number of issue
    let repo_name = req.body.repository.name; // issue repository
    let repo_owner = req.body.repository.owner.login; // repository owner
    let issue_labels = ["in progress"]; // create array for new issue labels
    let issue_assignees = [commenter]; // create array for new assignees
    if (body.includes("@zulipbot claim")) { // check body content for "@zulipbot claim"
      github.repos.checkCollaborator({ // check if commenter is a collaborator
          owner: repo_owner,
          repo: repo_name,
          username: commenter
        })
        .catch( // if commenter is not collaborator
          github.repos.addCollaborator({ // give commenter read-only (pull) access
            owner: repo_owner,
            repo: repo_name,
            username: commenter,
            permission: "pull"
          })
          .catch(console.error)
          .then(
            github.issues.addAssigneesToIssue({ // add assignee
              owner: repo_owner,
              repo: repo_name,
              number: issue_number,
              assignees: issue_assignees
            })
            .catch(console.error)
          )
        )
        .then(
          github.issues.addAssigneesToIssue({ // add assignee
            owner: repo_owner,
            repo: repo_name,
            number: issue_number,
            assignees: issue_assignees
          })
          .catch(console.error)
          .then(
            github.issues.addLabels({ // add labels
              owner: repo_owner,
              repo: repo_name,
              number: issue_number,
              labels: issue_labels
            }))
          .catch(console.error)
        )
    }
  }
});
