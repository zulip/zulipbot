import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { retry, type RetryPlugin } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import _ from "lodash";
import type { Writable } from "type-fest";
import * as custom from "../config/config.ts";
import * as defaults from "../config/default.ts";
import commands, {
  type CommandAliases,
  type CommandPayload,
} from "./commands/index.ts";
import Template from "./structures/template.ts";

const MyOctokit = Octokit.plugin(retry, throttling);

export class Bot {
  octokit: Octokit & RetryPlugin;
  cfg: Writable<typeof defaults>;
  commands: Map<
    string,
    {
      run: (
        bot: Bot,
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
    this.octokit = new MyOctokit({
      auth: cfg.auth.oAuthToken,
      retry: {
        enabled: process.env["NODE_ENV"] !== "test",
        retries: 1,
      },
      throttle: {
        enabled: process.env["NODE_ENV"] !== "test",
        onRateLimit(retryAfter, { method, url }, octokit, retryCount) {
          if (retryCount < 3) {
            octokit.log.warn(
              `Rate limit exceeded ${
                retryCount + 1
              } times for ${method} ${url}; retrying in ${retryAfter} seconds`,
            );
            return true; // eslint-disable-line @typescript-eslint/strict-void-return
          }

          octokit.log.warn(
            `Rate limit exceeded ${
              retryCount + 1
            } times for ${method} ${url}; aborting`,
          );
          return; // eslint-disable-line no-useless-return
        },
        onSecondaryRateLimit(_retryAfter, { method, url }, octokit) {
          octokit.log.warn(
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

    const templates = fs.globSync(
      path.join(import.meta.dirname, "../config/templates/*.md"),
    );
    for (const file of templates) {
      const name = path.basename(file, ".md");
      const content = fs.readFileSync(file, "utf8");
      const template = new Template(this, name, content);
      this.templates.set(name, template);
    }
  }
}

export const bot = new Bot();
