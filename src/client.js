"use strict";

const fs = require("fs");

const { Octokit } = require("@octokit/rest");

const cfg = require("../config/default.js");

const commands = require("./commands");
const events = require("./events");
const responses = require("./events/responses");
const Template = require("./structures/template.js");
const util = require("./util.js");

const client = new Octokit({
  auth: cfg.auth.oAuthToken,
});
client.cfg = cfg;
client.util = util;

for (const method of Object.keys(client.util)) {
  client.util[method] = client.util[method].bind(client);
}

client.commands = new Map();
client.events = new Map();
client.invites = new Map();
client.responses = new Map();
client.templates = new Map();

for (const data of commands) {
  const [category, name] = data.aliasPath.split(".");
  const aliases = client.cfg.issues.commands[category][name];
  for (let index = aliases.length; index--; ) {
    client.commands.set(aliases[index], data);
  }
}

for (const data of events) {
  for (let index = data.events.length; index--; ) {
    client.events.set(data.events[index], data.run.bind(client));
  }
}

for (const [name, data] of Object.entries(responses)) {
  for (const method of Object.keys(data)) {
    data[method] = data[method].bind(client);
  }

  client.responses.set(name, data);
}

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
