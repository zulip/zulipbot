/**
  * EXAMPLE CUSTOM ZULIPBOT CONFIGURATION — Zulip
  *
  * See https://github.com/zulip/zulipbot/wiki/configuration for detailed
  * explanations on each option.
  */

exports.issues = {
  commands: {
    assign: {
      claim: {
        aliases: ["claim"],
        permission: "pull"
      },
      abandon: {
        aliases: ["abandon", "unclaim", "abort"]
      }
    },
    label: {
      add: {
        aliases: ["label", "add"]
      },
      remove: {
        aliases: ["unlabel", "remove"]
      }
    }
  },
  area: {
    labels: new Map([
      ["area: accessibility", "server-misc"],
      ["area: analytics", "server-analytics"],
      ["area: api", "server-api"],
      ["area: authentication", "server-authentication"],
      ["area: bots", "server-bots"],
      ["area: browser-support", "server-browser-support"],
      ["area: compose", "server-compose"],
      ["area: db cleanup", "server-misc"],
      ["area: dependencies", "server-dependencies"],
      ["area: documentation (api and integrations)", "server-api"],
      ["area: documentation (developer)", "server-development"],
      ["area: documentation (production)", "server-production"],
      ["area: documentation (user)", "server-user-docs"],
      ["area: emails", "server-development"],
      ["area: emoji", "server-emoji"],
      ["area: export", "server-misc"],
      ["area: hotkeys", "server-hotkeys"],
      ["area: i18n", "server-i18n"],
      ["area: in", "server-in"],
      ["area: integrations", "server-integrations"],
      ["area: invitations", "server-onboarding"],
      ["area: left-sidebar", "server-sidebars"],
      ["area: markdown", "server-markdown"],
      ["area: message-editing", "server-message-view"],
      ["area: message view", "server-message-view"],
      ["area: misc", "server-misc"],
      ["area: notifications", "server-notifications"],
      ["area: onboarding", "server-onboarding"],
      ["area: portico", "server-misc"],
      ["area: production installer", "server-production"],
      ["area: production", "server-production"],
      ["area: provision", "server-development"],
      ["area: real-time sync", "server-misc"],
      ["area: refactoring", "server-refactoring"],
      ["area: right-sidebar", "server-sidebars"],
      ["area: search", "server-search"],
      ["area: settings (admin/org)", "server-settings"],
      ["area: settings UI", "server-settings"],
      ["area: settings (user)", "server-settings"],
      ["area: stream settings", "server-streams"],
      ["area: testing-coverage", "server-testing"],
      ["area: testing-infrastructure", "server-testing"],
      ["area: tooling", "server-tooling"],
      ["area: topics", "server-misc"],
      ["area: uploads", "server-misc"],
      ["area: webpack", "server-development"]
    ]),
    commitReferences: true
  }
};

exports.pullRequests = {
  mergeConflicts: true,
  wip: "WIP",
  travis: "travis updates"
};

exports.inactivity = {
  label: "inactive",
  check: {
    repositories: [
      "zulip/zulip",
      "zulip/zulip-mobile",
      "zulip/zulip-electron",
      "zulip/zulipbot"
    ],
    interval: 6,
    reminder: 10,
    limit: 4
  },
  issues: {
    inProgress: "in progress",
    clearClosed: true
  },
  pullRequests: {
    reviewed: {
      label: "reviewed"
    },
    needsReview: {
      label: "needs review"
    }
  }
};

exports.eventsDelay = 3;
