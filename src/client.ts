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

  // Simple cache to reduce redundant API calls
  // Key format: "type:owner:repo:identifier"
  // Cache duration: 5 minutes
  private readonly cache: Map<string, { data: unknown; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Cache statistics for monitoring effectiveness
  private cacheHits = 0;
  private cacheMisses = 0;

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
          // Use configured retry attempts for better resilience
          if (retryCount < cfg.rateLimit.retry.maxAttempts) {
            this.log.warn(
              `Rate limit exceeded ${
                retryCount + 1
              } times for ${method} ${url}; retrying in ${retryAfter} seconds`,
            );
            return true;
          }

          this.log.error(
            `Rate limit exceeded ${
              retryCount + 1
            } times for ${method} ${url}; aborting after max retries (${cfg.rateLimit.retry.maxAttempts})`,
          );
          return false;
        },
        onSecondaryRateLimit: (
          retryAfter,
          { method, url },
          _octokit,
          retryCount,
        ) => {
          // Handle secondary rate limits with configured retry attempts
          if (retryCount < cfg.rateLimit.retry.secondaryMaxAttempts) {
            this.log.warn(
              `Secondary rate limit detected for ${method} ${url}; retrying in ${retryAfter} seconds (attempt ${retryCount + 1})`,
            );
            return true;
          }

          this.log.error(
            `Secondary rate limit exceeded for ${method} ${url}; aborting after max retries (${cfg.rateLimit.retry.secondaryMaxAttempts})`,
          );
          return false;
        },
      },
    });
    this.cfg = cfg;

    this.commands = new Map();
    this.invites = new Map();
    this.templates = new Map();
    this.cache = new Map();

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

  /**
   * Get cached data if available and not expired
   */
  getCached<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) {
      this.cacheMisses++;
      return undefined;
    }

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      this.cacheMisses++;
      return undefined;
    }

    this.cacheHits++;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- generic cache returns caller-specified type
    return cached.data as T;
  }

  /**
   * Store data in cache with current timestamp
   */
  setCached(key: string, data: unknown): void {
    this.cache.set(key, { data: data, timestamp: Date.now() });
  }

  /**
   * Clear cache entry
   */
  clearCached(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
      size: this.cache.size,
    };
  }

  /**
   * Reset cache statistics (useful for monitoring periods)
   */
  resetCacheStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

export default new Client();
