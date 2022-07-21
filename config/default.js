/**
 * DEFAULT ZULIPBOT CONFIGURATION — DO NOT EDIT
 *
 * See https://github.com/zulip/zulipbot/wiki/Configuration for detailed
 * explanations on each option.
 */

// Default authentication specified by environment variables
export const auth = {
  oAuthToken: process.env.OAUTH_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET,
};

/**
 * Issue triage
 * - Commands (assigning users, labelling issues)
 * - Area label system
 */

export const issues = {
  commands: {
    assign: {
      claim: [],
      abandon: [],
      limit: Number.POSITIVE_INFINITY,
      newContributors: {
        permission: null,
        restricted: Number.POSITIVE_INFINITY,
      },
      warn: {
        labels: [],
        presence: false,
        force: true,
      },
    },
    label: {
      add: [],
      remove: [],
      self: false,
    },
  },
  area: {
    labels: null,
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
      label: null,
      comment: false,
    },
    wip: null,
    size: {
      labels: null,
      exclude: [],
    },
  },
  references: {
    required: false,
    labels: false,
  },
};

/**
 * Automatic issue/pull request inactivity checks
 * - Active repositories
 * - Inactivity check interval, reminders, and limits
 * - Review statuses for pull requests
 */

export const activity = {
  inactive: null,
  check: {
    repositories: [],
    interval: null,
    reminder: null,
    limit: null,
  },
  issues: {
    inProgress: null,
    clearClosed: false,
  },
  pulls: {
    autoUpdate: true,
    reviewed: {
      label: null,
      assignee: null,
    },
    needsReview: {
      label: null,
      ignore: false,
    },
  },
};

// Delay (in seconds) responses to certain events
export const eventsDelay = 0;
