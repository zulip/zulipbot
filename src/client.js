import fs from "fs";

import { Octokit } from "@octokit/rest";
import _ from "lodash";

import * as custom from "../config/config.js";
import * as defaults from "../config/default.js";

import commands from "./commands/index.js";
import events from "./events/index.js";
import * as responses from "./events/responses/index.js";
import Template from "./structures/template.js";
import * as util from "./util.js";

const cfg = _.merge({}, defaults, custom);
const client = new Octokit({
  auth: cfg.auth.oAuthToken,
});
client.cfg = cfg;
client.util = { ...util };

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

for (const [name, { ...data }] of Object.entries(responses)) {
  for (const method of Object.keys(data)) {
    data[method] = data[method].bind(client);
  }

  client.responses.set(name, data);
}

const templates = fs.readdirSync(
  new URL("../config/templates", import.meta.url)
);
for (const file of templates) {
  const [name] = file.split(".md");
  const content = fs.readFileSync(
    new URL(`../config/templates/${file}`, import.meta.url),
    "utf8"
  );
  const template = new Template(client, name, content);
  client.templates.set(name, template);
}

export default client;
