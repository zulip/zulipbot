/**
  * DEFAULT ZULIPBOT CONFIGURATION — DO NOT EDIT
  *
  * See https://github.com/zulip/zulipbot/wiki/Configuration for detailed
  * explanations on each option.
  */

// Authentication
exports.auth = {
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  webhookSecret: process.env.WEBHOOK_SECRET
};

try {
  const secrets = require("./secrets.json");

  exports.auth = {
    username: secrets.username,
    password: secrets.password,
    webhookSecret: secrets.webhookSecret
  };

  console.log("Authenticating with `./config/secrets.json`...");
} catch (e) {
  console.log("`./config/secrets.json` was not found.",
    "Authenticating with environment variables...");
}

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
      newContributors: {
        permission: null,
        restricted: Infinity
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

exports.pullRequests = {
  status: {
    mergeConflicts: null,
    wip: null
  },
  references: {
    required: false
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
  pullRequests: {
    autoUpdate: true,
    reviewed: {
      label: null,
      assignee: null
    },
    needsReview: {
      label: null
    }
  }
};

// Delay (in seconds) responses to certain events
exports.eventsDelay = 0;

// Apply custom configuration on top of default configuration
const custom = require("./config.js");
module.exports = require("../node_modules/lodash").merge(exports, custom);
