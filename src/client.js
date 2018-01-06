const GitHub = require("github");
const client = new GitHub();
const fs = require("fs");

client.cfg = require("../config/default.js");

client.automations = new Map();
client.commands = new Map();
client.events = new Map();
client.invites = new Map();
client.templates = new Map();

const commands = fs.readdirSync("./src/commands");
for (const file of commands) {
  const data = require(`./commands/${file}`);
  for (let i = data.aliases.length; i--;) {
    client.commands.set(data.aliases[i], data);
  }
}

const templates = fs.readdirSync("./src/templates");
for (const file of templates) {
  const text = fs.readFileSync(`./src/templates/${file}`, "utf8");
  client.templates.set(file.slice(0, -3), text);
}

const events = fs.readdirSync("./src/events");
for (const event of events) {
  const data = require(`./events/${event}`);
  for (let i = data.events.length; i--;) {
    client.events.set(data.events[i], data);
  }
}

const automations = fs.readdirSync("./src/automations");
for (const file of automations) {
  const data = require(`./automations/${file}`);
  client.automations.set(file.slice(0, -3), data);
}

client.authenticate({
  type: "basic",
  username: client.cfg.auth.username,
  password: client.cfg.auth.password
});

client.newComment = (issue, repository, body, replacePR) => {
  const number = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  // Check if comment is being posted on a pull request
  if (replacePR) {
    body = body.replace(/\[payload\]/g, "pull request");
  } else {
    body = body.replace(/\[payload\]/g, "issue");
  }

  client.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: body
  });
};

client.getAll = async function(client, responses, func) {
  let response = await func;
  responses = responses.concat(response.data);
  while (client.hasNextPage(response)) {
    response = await client.getNextPage(response);
    responses = responses.concat(response.data);
  }
  return responses;
};

module.exports = client;
