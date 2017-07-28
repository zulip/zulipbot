const secrets = require("./secrets.json");

module.exports = {
  username: secrets.username, // hidden username for GitHub API client in secrets.js
  password: secrets.password, // hidden password for GitHub API client in secrets.js
  webhookSecret: secrets.webhookSecret, // hidden webhook secret for validating GitHub
  claimCommands: ["claim"], // configured aliases for "claim" command
  addCollabPermission: "pull", // permission level of new collaborator; collaborator will not be added if null
  abandonCommands: ["abandon", "unclaim", "abort"], // configured aliases for "abandon" command
  labelCommands: ["label", "add"], // configured aliases for "label" command
  removeCommands: ["remove", "unlabel"], // configured aliases for "remove"" command
  selfLabelingOnly: true, // enable/disable only issue/PR author can label their issue/PR
  commitReferenceEnabled: true, // enable/disable commit reference notifications for label teams
  clearClosedIssues: true, // enable/disable removing "in progress" labels and assignees from closed issues
  checkMergeConflicts: true, // enable/disable merge conflict warnings on PRs
  repoEventsDelay: 3 * 60 * 1000, // delay for repo events (merge conflict checks, closed issue clearance)
  escapeWIPString: "WIP", // disable mentioning of teams on PRs with WIP string in title; teams will always be notified if null
  areaLabels: new Map([ // map of area labels and corresponding teams; area label team references will not be enabled if null
    ["area: accessibility", "server-misc"], // format: ["label name", "team-slug"]
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
  activeRepos: ["zulip/zulip", "zulip/zulip-mobile", "zulip/zulip-electron", "zulip/zulipbot"], // array of repositories to check inactivity for
  // checkInactivityTimeout: 3600, // how often to check for inactivity (1 hour); will not check for inactivity if null
  inactivityTimeLimit: 3600 * 24 * 7, // time limit of inactive issue/PR (7 days)
  autoAbandonTimeLimit: 3600 * 24 * 3, // time limit of auto-unassigning of inactive issue (3 days)
  travisLabel: "travis updates", // label for tracking Travis build updates of PRs (needs webhook configuration .travis.yml); will not track Travis builds if null
  inProgressLabel: "in progress", // label for progress that were claimed; will not be added to claimed issues if null
  inactiveLabel: "inactive", // label for inactive issues/PRs that zulipbot will not track for activity; will track all issues/PRs for activity if null
  reviewedLabel: "reviewed", // label for reviewed PRs; review system disabled if null
  needsReviewLabel: "needs review", // label for PRs needign review; review system disabled if null
  priorityLabels: ["priority: high", "priority: medium", "priority: low", "priority"], // array of labels for unclaimed "priority" issues daily digest
  pullRequestsAssignee: false // enable/disable assigning PR reviewers to PRs
};
