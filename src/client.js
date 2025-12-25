import fs from "fs";

import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import _ from "lodash";

import * as custom from "../config/config.js";
import * as defaults from "../config/default.js";

import commands from "./commands/index.js";
import Template from "./structures/template.js";

export class Client extends Octokit.plugin(retry, throttling) {
  constructor() {
    const cfg = _.merge({}, defaults, custom);
    super({
      auth: cfg.auth.oAuthToken,
      retry: {
        enabled: process.env.NODE_ENV !== "test",
      },
      throttle: {
        enabled: process.env.NODE_ENV !== "test",
        onRateLimit: (retryAfter, { method, url }, _octokit, retryCount) => {
          if (retryCount < 3) {
            this.log.warn(
              `Rate limit exceeded ${
                retryCount + 1
              } times for ${method} ${url}; retrying in ${retryAfter} seconds`,
            );
            return true;
          }

          this.log.warn(
            `Rate limit exceeded ${
              retryCount + 1
            } times for ${method} ${url}; aborting`,
          );
        },
        onSecondaryRateLimit: (retryAfter, { method, url }) => {
          this.log.warn(
            `Secondary rate limit detected for ${method} ${url}; aborting`,
          );
        },
      },
    });
    this.cfg = cfg;

    this.commands = new Map();
    this.invites = new Map();
    this.templates = new Map();

    for (const data of commands) {
      const aliases = data.aliasPath(this.cfg.issues.commands);
      for (const alias of aliases) {
        this.commands.set(alias, data);
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
      const template = new Template(this, name, content);
      this.templates.set(name, template);
    }
  }
}

export default new Client();
