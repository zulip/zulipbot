import fs from "fs";

import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import _ from "lodash";

import * as custom from "../config/config.js";
import * as defaults from "../config/default.js";

import commands from "./commands/index.js";
import Template from "./structures/template.js";

const MyOctokit = Octokit.plugin(retry, throttling);

const cfg = _.merge({}, defaults, custom);
const client = new MyOctokit({
  auth: cfg.auth.oAuthToken,
  retry: {
    enabled: process.env.NODE_ENV !== "test",
  },
  throttle: {
    enabled: process.env.NODE_ENV !== "test",
    onRateLimit: (retryAfter, { method, url }, _octokit, retryCount) => {
      if (retryCount < 3) {
        client.log.warn(
          `Rate limit exceeded ${
            retryCount + 1
          } times for ${method} ${url}; retrying in ${retryAfter} seconds`,
        );
        return true;
      }

      client.log.warn(
        `Rate limit exceeded ${
          retryCount + 1
        } times for ${method} ${url}; aborting`,
      );
    },
    onSecondaryRateLimit: (retryAfter, { method, url }) => {
      client.log.warn(
        `Secondary rate limit detected for ${method} ${url}; aborting`,
      );
    },
  },
});
client.cfg = cfg;

client.commands = new Map();
client.invites = new Map();
client.templates = new Map();

for (const data of commands) {
  const [category, name] = data.aliasPath.split(".");
  const aliases = client.cfg.issues.commands[category][name];
  for (const alias of aliases) {
    client.commands.set(alias, data);
  }
}

const templates = fs.readdirSync(
  new URL("../config/templates", import.meta.url),
);
for (const file of templates) {
  const [name] = file.split(".md");
  const content = fs.readFileSync(
    new URL(`../config/templates/${file}`, import.meta.url),
    "utf8",
  );
  const template = new Template(client, name, content);
  client.templates.set(name, template);
}

export default client;
