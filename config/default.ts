/**
 * DEFAULT ZULIPBOT CONFIGURATION — DO NOT EDIT
 *
 * See https://github.com/zulip/zulipbot/wiki/Configuration for detailed
 * explanations on each option.
 */

import { safeCastTo } from "ts-extras";

// Default authentication specified by environment variables
export const auth: {
  oAuthToken: string | undefined;
  webhookSecret: string | undefined;
  username?: string;
} = {
  oAuthToken: process.env["OAUTH_TOKEN"],
  webhookSecret: process.env["WEBHOOK_SECRET"],
};

/**
 * Issue triage
 * - Commands (assigning users, labelling issues)
 * - Area label system
 */

export const issues = {
  commands: {
    assign: {
      claim: new Array<string>(),
      abandon: new Array<string>(),
      limit: Number.POSITIVE_INFINITY,
      newContributors: {
        permission: safeCastTo<string | null>(null),
        restricted: Number.POSITIVE_INFINITY,
      },
      warn: {
        labels: new Array<string>(),
        presence: false,
        force: true,
      },
    },
    label: {
      add: new Array<string>(),
      remove: new Array<string>(),
      self: safeCastTo<boolean | { users: string[] }>(false),
    },
  },
  area: {
    labels: safeCastTo<Map<string, string> | null>(null),
    references: false,
  },
};

/**
 * Pull requests
 * - Monitor status (merge conflicts, WIP status)
 * - Track commit references
 * - Continuous integration build updates
 */

export const pulls = {
  status: {
    mergeConflicts: {
      branch: "main",
      label: safeCastTo<string | null>(null),
      comment: false,
    },
    wip: safeCastTo<string | null>(null),
    size: {
      labels: safeCastTo<Map<string, number> | null>(null),
      exclude: new Array<string>(),
    },
  },
  references: {
    required: false,
    labels: safeCastTo<
      | { include: string[]; exclude?: never }
      | { include?: never; exclude: string[] }
      | false
    >(false),
  },
};

/**
 * Automatic issue/pull request inactivity checks
 * - Active repositories
 * - Inactivity check interval, reminders, and limits
 * - Review statuses for pull requests
 */

export const activity = {
  inactive: safeCastTo<string | null>(null),
  check: {
    repositories: new Array<string>(),
    interval: safeCastTo<number | null>(null),
    reminder: safeCastTo<number | null>(null),
    limit: safeCastTo<number | null>(null),
  },
  issues: {
    inProgress: safeCastTo<string | undefined>(undefined),
    clearClosed: false,
  },
  pulls: {
    autoUpdate: true,
    reviewed: {
      label: safeCastTo<string | null>(null),
      assignee: safeCastTo<boolean | null>(null),
    },
    needsReview: {
      label: safeCastTo<string | null>(null),
      ignore: false,
    },
  },
};

// Delay (in seconds) responses to certain events
export const eventsDelay = 0;
