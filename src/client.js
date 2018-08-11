const client = require("@octokit/rest")();
const fs = require("fs");

const configPath = `${__dirname}/../config`;
client.cfg = require(`${configPath}/default.js`);
client.util = require("./util.js");
for (let method of Object.keys(client.util)) {
  client.util[method] = client.util[method].bind(client);
}

client.automations = new Map();
client.commands = new Map();
client.events = new Map();
client.invites = new Map();
client.templates = new Map();

const automations = fs.readdirSync(`${__dirname}/automations`);
for (const file of automations) {
  let data = require(`./automations/${file}`);
  for (let method of Object.keys(data)) {
    data[method] = data[method].bind(client);
  }
  client.automations.set(file.slice(0, -3), data);
}

const commands = fs.readdirSync(`${__dirname}/commands`);
for (const file of commands) {
  const data = require(`./commands/${file}`);
  for (let i = data.aliases.length; i--;) {
    client.commands.set(data.aliases[i], data);
  }
}

const events = fs.readdirSync(`${__dirname}/events`);
for (const event of events) {
  const data = require(`./events/${event}`);
  for (let i = data.events.length; i--;) {
    client.events.set(data.events[i], data.run.bind(client));
  }
}

const Template = require("./structures/Template.js");
const templates = fs.readdirSync(`${configPath}/templates`);
for (const file of templates) {
  const name = file.split(".md")[0];
  const content = fs.readFileSync(`${configPath}/templates/${file}`, "utf8");
  const template = new Template(client, name, content);
  client.templates.set(name, template);
}

client.authenticate({
  type: "basic",
  username: client.cfg.auth.username,
  password: client.cfg.auth.password
});

module.exports = client;
