const GitHubApi = require("github"); // NodeJS wrapper for GitHub API
const github = new GitHubApi(); // API client
github.cfg = require("./config.js"); // config file

github.authenticate({ // Authentication
  type: "basic",
  username: github.cfg.username,
  password: github.cfg.password
});

module.exports = github;
