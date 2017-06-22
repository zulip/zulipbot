const GitHub = require("github");
const client = new GitHub();
client.cfg = require("./config.js");
client.zulip = require("zulip-js")(client.cfg.zulip);

client.authenticate({
  type: "basic",
  username: client.cfg.username,
  password: client.cfg.password
});

client.newComment = (issue, repository, body, replacePR) => {
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (replacePR) body = body.replace(/\[payload\]/g, "pull request");
  else body = body.replace(/\[payload\]/g, "issue");
  client.issues.createComment({owner: repoOwner, repo: repoName, number: issueNumber, body: body});
};

client.send = (msg, topic) => {
  const params = {
    to: client.cfg.defaultStream,
    type: "stream",
    subject: topic,
    content: msg
  };
  client.zulip.messages.send(params);
};

module.exports = client;
