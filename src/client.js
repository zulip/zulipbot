"use strict";

const { Octokit } = require("@octokit/rest");
const fs = require("fs");

const cfg = require("../config/default.js");
const client = new Octokit({
  auth: cfg.auth.oAuthToken,
});
client.cfg = cfg;
client.util = require("./util.js");
for (const method of Object.keys(client.util)) {
  client.util[method] = client.util[method].bind(client);
}

client.commands = new Map();
client.events = new Map();
client.invites = new Map();
client.responses = new Map();
client.templates = new Map();

const commands = fs.readdirSync(`${__dirname}/commands`);
for (const file of commands) {
  const data = require(`./commands/${file}`);
  const [category, name] = data.aliasPath.split(".");
  const aliases = client.cfg.issues.commands[category][name];
  for (let i = aliases.length; i--; ) {
    client.commands.set(aliases[i], data);
  }
}

const events = fs.readdirSync(`${__dirname}/events`);
for (const event of events) {
  if (!event.includes(".")) continue;
  const data = require(`./events/${event}`);
  for (let i = data.events.length; i--; ) {
    client.events.set(data.events[i], data.run.bind(client));
  }
}

const responses = fs.readdirSync(`${__dirname}/events/responses`);
for (const file of responses) {
  const data = require(`./events/responses/${file}`);
  for (const method of Object.keys(data)) {
    data[method] = data[method].bind(client);
  }

  client.responses.set(file.slice(0, -3), data);
}

const Template = require("./structures/Template.js");
const templates = fs.readdirSync(`${__dirname}/../config/templates`);
for (const file of templates) {
  const [name] = file.split(".md");
  const content = fs.readFileSync(
    `${__dirname}/../config/templates/${file}`,
    "utf8"
  );
  const template = new Template(client, name, content);
  client.templates.set(name, template);
}

module.exports = client;
