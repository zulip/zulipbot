const GitHub = require("github");
const client = new GitHub();
const fs = require("fs");
const snekfetch = require("snekfetch");

client.cfg = require("./config.js");
client.automations = new Map();
client.commands = new Map();
client.events = new Map();
client.templates = new Map();

const commands = fs.readdirSync("./src/commands");
for (const file of commands) {
  const data = require(`./commands/${file}`);
  for (let i = data.aliases.length; i--;) client.commands.set(data.aliases[i], data);
}

const templates = fs.readdirSync("./src/templates");
for (const file of templates) {
  const text = fs.readFileSync(`./src/templates/${file}`, "utf8");
  client.templates.set(file.slice(0, -3), text);
}

const events = fs.readdirSync("./src/events");
for (const event of events) {
  const data = require(`./events/${event}`);
  for (let i = data.events.length; i--;) client.events.set(data.events[i], data);
}

const automations = fs.readdirSync("./src/automations");
for (const file of automations) {
  const data = require(`./automations/${file}`);
  client.automations.set(file.slice(0, -3), data);
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

client.abandonIssue = async function(client, commenter, repository, issue) {
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const auth = new Buffer(client.cfg.username + ":" + client.cfg.password, "ascii").toString("base64");
  const json = JSON.stringify({
    assignees: commenter
  });
  await snekfetch.delete(`https://api.github.com/repos/${repoOwner}/${repoName}/issues/${issueNumber}/assignees`)
  .set("content-type", "application/json").set("content-length", json.length).set("authorization", `Basic ${auth}`)
  .set("accept", "application/json").set("user-agent", client.cfg.username).send(json);
};

module.exports = client;
