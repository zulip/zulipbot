import fs from "fs";

import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import _ from "lodash";
import { assertDefined } from "ts-extras";
import type { Writable } from "type-fest";

import * as custom from "../config/config.ts";
import * as defaults from "../config/default.ts";

import commands, {
  type CommandAliases,
  type CommandPayload,
} from "./commands/index.ts";
import Template from "./structures/template.ts";

const MyOctokit: typeof Octokit &
  (new (
    ...args: any[]
  ) => ReturnType<typeof retry> & ReturnType<typeof throttling>) =
  Octokit.plugin(retry, throttling);

export class Client extends MyOctokit {
  cfg: Writable<typeof defaults>;
  commands: Map<
    string,
    {
      run: (
        this: Client,
        payload: CommandPayload,
        commenter: string,
        args: string,
      ) => Promise<unknown>;
      aliasPath: (commands: CommandAliases) => string[];
    }
  >;

  invites: Map<string, number>;
  templates: Map<string, Template>;

  constructor() {
    const cfg: Writable<typeof defaults> = _.merge({}, defaults, custom);
    super({
      auth: cfg.auth.oAuthToken,
      retry: {
        enabled: process.env["NODE_ENV"] !== "test",
      },
      throttle: {
        enabled: process.env["NODE_ENV"] !== "test",
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
          return; // eslint-disable-line no-useless-return
        },
        onSecondaryRateLimit: (_retryAfter, { method, url }) => {
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
      assertDefined(name);
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
