"use strict";

const assert = require("chai").assert;
const github = require("../src/github.js");

describe("secrets.json lint", () => {
  it("username should be a string.", () => {
    assert.typeOf(github.cfg.username, "string");
  });
  it("password should be a string.", () => {
    assert.typeOf(github.cfg.password, "string");
  });
  it("zulip.username should be a valid email and a string.", () => {
    assert.typeOf(github.cfg.zulip.username, "string");
    assert.isOk(/\S+@\S+\.\S+/.test(github.cfg.zulip.username));
  });
  it("zulip.apiKey should be an alphanumeric string.", () => {
    assert.typeOf(github.cfg.zulip.apiKey, "string");
    assert.isOk(new RegExp(/^[a-z0-9]+$/, "i").test(github.cfg.zulip.apiKey));
  });
  it("zulip.realm should be a valid URL and a string.", () => {
    assert.typeOf(github.cfg.zulip.realm, "string");
    assert.isOk(new RegExp(/[-a-zA-Z0-9@:\\\\%_+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+\\\\.~#?&//=]*)?/, "i").test(github.cfg.zulip.realm));
  });
});

describe("config.js lint", () => {
  it("claimCommands should be an array that only contains strings.", () => {
    assert.typeOf(github.cfg.claimCommands, "array");
    github.cfg.claimCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("abandonCommands should be an array that only contains strings.", () => {
    assert.typeOf(github.cfg.abandonCommands, "array");
    github.cfg.abandonCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("labelCommands should be an array that only contains strings.", () => {
    assert.typeOf(github.cfg.labelCommands, "array");
    github.cfg.labelCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("removeCommands should be an array that only contains strings.", () => {
    assert.typeOf(github.cfg.removeCommands, "array");
    github.cfg.removeCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("selfLabelingOnly should be a boolean.", () => {
    assert.isNotNull(github.cfg.selfLabelingOnly);
    assert.typeOf(github.cfg.selfLabelingOnly, "boolean");
  });
  it("joinCommands should be an array that only contains strings.", () => {
    assert.typeOf(github.cfg.joinCommands, "array");
    github.cfg.joinCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("commitReferenceEnabled should be a boolean.", () => {
    assert.isNotNull(github.cfg.commitReferenceEnabled);
    assert.typeOf(github.cfg.commitReferenceEnabled, "boolean");
  });
  it("checkMergeConflicts should be a boolean.", () => {
    assert.isNotNull(github.cfg.checkMergeConflicts);
    assert.typeOf(github.cfg.checkMergeConflicts, "boolean");
  });
  it("checkMergeConflictsDelay should be a postive integer if it is defined.", () => {
    if (github.cfg.checkMergeConflictsDelay) assert(!isNaN(parseFloat(github.cfg.checkMergeConflictsDelay)) && isFinite(github.cfg.checkMergeConflictsDelay));
    else assert.isUndefined(github.cfg.checkMergeConflictsDelay);
  });
  it("areaLabels should be a map if it is defined.", () => {
    if (github.cfg.areaLabels) assert.typeOf(github.cfg.areaLabels, "map");
    else assert.isUndefined(github.cfg.areaLabels);
  });
  it("addCollabPermission should be a valid string if it is defined.", () => {
    const permissions = ["pull", "push", "admin"];
    if (github.cfg.addCollabPermission) assert(permissions.includes(github.cfg.addCollabPermission));
    else assert.isUndefined(github.cfg.addCollabPermission);
  });
  it("escapeWIPString should be a string if it is defined.", () => {
    if (github.cfg.escapeWIPString) assert.typeOf(github.cfg.escapeWIPString, "string");
    else assert.isUndefined(github.cfg.escapeWIPString);
  });
  it("activeRepos should be an array of properly-formatted strings.", () => {
    assert.typeOf(github.cfg.activeRepos, "array");
    github.cfg.activeRepos.forEach((repo) => {
      assert.typeOf(repo, "string");
      assert.include(repo, "/", "Repositories are in format repoOwner/repoName");
    });
  });
  it("checkInactivityTimeout should be a postive integer if it is defined.", () => {
    if (github.cfg.checkInactivityTimeout) assert(!isNaN(parseFloat(github.cfg.checkInactivityTimeout)) && isFinite(github.cfg.checkInactivityTimeout));
    else assert.isUndefined(github.cfg.checkInactivityTimeout);
  });
  it("inactivityTimeLimit should be a postive integer if it is defined.", () => {
    if (github.cfg.inactivityTimeLimit) assert(!isNaN(parseFloat(github.cfg.inactivityTimeLimit)) && isFinite(github.cfg.inactivityTimeLimit));
    else assert.isUndefined(github.cfg.inactivityTimeLimit);
  });
  it("autoAbandonTimeLimit should be a postive integer if it is defined.", () => {
    if (github.cfg.autoAbandonTimeLimit) assert(!isNaN(parseFloat(github.cfg.autoAbandonTimeLimit)) && isFinite(github.cfg.autoAbandonTimeLimit));
    else assert.isUndefined(github.cfg.autoAbandonTimeLimit);
  });
  it("travisLabel should be a string if it is defined.", () => {
    if (github.cfg.travisLabel) assert.typeOf(github.cfg.travisLabel, "string");
    else assert.isUndefined(github.cfg.travisLabel);
  });
  it("inProgressLabel should be a string if it is defined.", () => {
    if (github.cfg.inProgressLabel) assert.typeOf(github.cfg.inProgressLabel, "string");
    else assert.isUndefined(github.cfg.inProgressLabel);
  });
  it("inactiveLabel should be a string if it is defined.", () => {
    if (github.cfg.inactiveLabel) assert.typeOf(github.cfg.inactiveLabel, "string");
    else assert.isUndefined(github.cfg.inactiveLabel);
  });
  it("reviewedLabel should be a string if it is defined.", () => {
    if (github.cfg.reviewedLabel) assert.typeOf(github.cfg.reviewedLabel, "string");
    else assert.isUndefined(github.cfg.reviewedLabel);
  });
  it("needsReviewLabel should be a string if it is defined.", () => {
    if (github.cfg.needsReviewLabel) assert.typeOf(github.cfg.needsReviewLabel, "string");
    else assert.isUndefined(github.cfg.needsReviewLabel);
  });
  it("priorityLabels should be an array of properly-formatted strings.", () => {
    assert.typeOf(github.cfg.priorityLabels, "array");
    github.cfg.priorityLabels.forEach((repo) => {
      assert.typeOf(repo, "string");
    });
  });
  it("pullRequestsAssignee should be a boolean.", () => {
    assert.isNotNull(github.cfg.pullRequestsAssignee);
    assert.typeOf(github.cfg.pullRequestsAssignee, "boolean");
  });
  it("defaultStream should be a string.", () => {
    assert.isNotNull(github.cfg.defaultStream);
    assert.typeOf(github.cfg.defaultStream, "string");
  });
});
