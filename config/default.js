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

Object.entries(exports.auth).forEach(pair => {
  const key = pair[0];
  const value = pair[1];

  if (typeof value === "string") {
    console.log(`Using environment variable value for \`${key}\`...`);
    return;
  }

  try {
    console.log(`Using value from \`./config/secrets.json\` for \`${key}\`...`);
    const secrets = require("./secrets.json");
    if (typeof secrets[key] !== "string") throw new Error();
    exports.auth[key] = secrets[key];
  } catch (e) {
    console.log(`\`${key}\` value was not set. Please fix your configuration.`);
    process.exit(1);
  }
});

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
        restricted: Infinity,
        warn: {
          labels: [],
          presence: false
        }
      },
      multiple: false
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
  pullRequests: {
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
module.exports = require("../node_modules/lodash").merge(exports, custom);
