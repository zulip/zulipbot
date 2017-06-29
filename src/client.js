const GitHub = require("github");
const client = new GitHub();
const fs = require("fs");

client.cfg = require("./config.js");
client.zulip = require("zulip-js")(client.cfg.zulip);
client.commands = new Map();
client.aliases = new Map();
client.templates = new Map();

const commands = fs.readdirSync("./src/commands");
for (const file of commands) {
  const data = require(`./commands/${file}`);
  client.commands.set(file.slice(0, -3), data);
  for (let i = data.aliases.length; i--;) client.aliases.set(data.aliases[i], data.name);
}

const templates = fs.readdirSync("./src/templates");
for (const file of templates) {
  const text = fs.readFileSync(`./src/templates/${file}`, "utf8");
  client.templates.set(file.slice(0, -3), text);
}

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
