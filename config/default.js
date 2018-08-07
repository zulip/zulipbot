/**
 * DEFAULT ZULIPBOT CONFIGURATION — DO NOT EDIT
 *
 * See https://github.com/zulip/zulipbot/wiki/Configuration for detailed
 * explanations on each option.
 */

// Default authentication specified by environment variables
exports.auth = {
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  webhookSecret: process.env.WEBHOOK_SECRET
};

/**
 * Issue triage
 * - Commands (assigning users, labelling issues)
 * - Area label system
 */

exports.issues = {
  commands: {
    assign: {
      claim: [],
      abandon: [],
      limit: Infinity,
      newContributors: {
        permission: null,
        restricted: Infinity,
        warn: {
          labels: [],
          presence: false,
          force: true
        }
      }
    },
    label: {
      add: [],
      remove: [],
      self: false
    }
  },
  area: {
    labels: null,
    references: false
  }
};

/**
 * Pull requests
 * - Monitor status (merge conflicts, WIP status)
 * - Track commit references
 * - Continuous integration build updates
 */

exports.pulls = {
  status: {
    mergeConflicts: {
      label: null,
      comment: false
    },
    wip: null,
    size: {
      labels: null,
      exclude: []
    }
  },
  references: {
    required: false,
    labels: false
  },
  ci: {
    travis: null
  }
};

/**
 * Automatic issue/pull request inactivity checks
 * - Active repositories
 * - Inactivity check interval, reminders, and limits
 * - Review statuses for pull requests
 */

exports.activity = {
  inactive: null,
  check: {
    repositories: [],
    interval: null,
    reminder: null,
    limit: null
  },
  issues: {
    inProgress: null,
    clearClosed: false
  },
  pulls: {
    autoUpdate: true,
    reviewed: {
      label: null,
      assignee: null
    },
    needsReview: {
      label: null,
      ignore: false
    }
  }
};

// Delay (in seconds) responses to certain events
exports.eventsDelay = 0;

// Apply custom configuration on top of default configuration
const custom = require("./config.js");
module.exports = require("lodash").merge(exports, custom);
