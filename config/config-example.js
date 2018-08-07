/**
 * EXAMPLE CUSTOM ZULIPBOT CONFIGURATION — Zulip
 *
 * See https://github.com/zulip/zulipbot/wiki/configuration for detailed
 * explanations on each option.
 */

exports.issues = {
  commands: {
    assign: {
      claim: ["claim"],
      abandon: ["abandon", "unclaim", "abort"],
      limit: 1,
      newContributors: {
        permission: "pull",
        restricted: 1,
        warn: {
          labels: ["help wanted", "good first issue"],
          force: false
        }
      }
    },
    label: {
      add: ["label", "add"],
      remove: ["unlabel", "remove"]
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
      ["area: export/import", "server-misc"],
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
    references: true
  }
};

exports.pulls = {
  status: {
    mergeConflicts: {
      label: "has conflicts",
      comment: true
    },
    wip: "[WIP]",
    size: {
      labels: new Map([
        ["size: XS", 0],
        ["size: S", 5],
        ["size: M", 25],
        ["size: L", 50],
        ["size: XL", 100]
      ]),
      exclude: ["frontend_tests/", "zerver/tests/"]
    }
  },
  references: {
    required: true,
    labels: {
      exclude: [
        "in progress",
        "good first issue",
        "good sprint project",
        "help wanted"
      ]
    }
  },
  ci: {
    travis: "travis updates"
  }
};

exports.activity = {
  inactive: "inactive",
  check: {
    repositories: [
      "zulip/zulip",
      "zulip/python-zulip-api",
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
  pulls: {
    autoUpdate: false,
    reviewed: {
      label: "reviewed"
    },
    needsReview: {
      label: "needs review",
      ignore: true
    }
  }
};

exports.eventsDelay = 3;
