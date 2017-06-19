const GitHubApi = require("github");
const github = new GitHubApi(); // API client
github.cfg = require("./config.js"); // config file
github.zulip = require("zulip-js")(github.cfg.zulip);

github.authenticate({ // Authentication
  type: "basic",
  username: github.cfg.username,
  password: github.cfg.password
});

github.send = (msg, topic) => {
  const params = {
    to: github.cfg.defaultStream,
    type: "stream",
    subject: topic,
    content: msg
  };
  github.zulip.messages.send(params);
};

module.exports = github;
