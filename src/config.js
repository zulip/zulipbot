// Documentation is ongoing at https://github.com/zulip/zulipbot/issues/120

const secrets = require("./secrets.json");

module.exports = {
  username: process.env.USERNAME || secrets.username,
  password: process.env.PASSWORD || secrets.password,
  webhookSecret: process.env.WEBHOOK_SECRET || secrets.webhookSecret,
  claimCommands: ["claim"], 
  addCollabPermission: "pull",
  abandonCommands: ["abandon", "unclaim", "abort"],
  labelCommands: ["label", "add"], 
  removeCommands: ["remove", "unlabel"], 
  sudoUsers: ["opendatakit-bot"],
  selfLabelingOnly: false, // collaborators can "label" issues that are not theirs
  commitReferenceEnabled: true,
  clearClosedIssues: true,
  checkMergeConflicts: true,
  repoEventsDelay: 3, 
  escapeWIPString: "WIP",
  // areaLabels: new Map([
  //   ["label name", "team-slug"],
  // ]),
  activeRepos: [
    "opendatakit/aggregate",
    "opendatakit/briefcase",
    "opendatakit/build",
    "opendatakit/collect",
    "opendatakit/docs",
    "opendatakit/javarosa",
    "opendatakit/xforms-spec"
    ], // repositories to check inactivity for
  checkInactivityTimeout: 6,
  inactivityTimeLimit: 7,
  autoAbandonTimeLimit: 3,
  // travisLabel: "travis updates",
  inProgressLabel: "in progress",
  inactiveLabel: "inactive",
  reviewedLabel: "reviewed",
  needsReviewLabel: "needs review",
  priorityLabels: ["priority: high", "priority: medium", "priority: low", "priority"],
  pullRequestsAssignee: true // if you submit a review to a PR, you are assigned to it
};
