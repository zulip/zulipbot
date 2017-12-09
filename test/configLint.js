const assert = require("chai").assert;
const client = require("../src/client.js");

describe("secrets.json lint", () => {
  it("username should be a string.", () => {
    assert.typeOf(client.cfg.username, "string");
  });
  it("password should be a string.", () => {
    assert.typeOf(client.cfg.password, "string");
  });
});

describe("config.js lint", () => {
  it("claimCommands should be an array that only contains strings.", () => {
    assert.typeOf(client.cfg.claimCommands, "array");
    client.cfg.claimCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("abandonCommands should be an array that only contains strings.", () => {
    assert.typeOf(client.cfg.abandonCommands, "array");
    client.cfg.abandonCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("labelCommands should be an array that only contains strings.", () => {
    assert.typeOf(client.cfg.labelCommands, "array");
    client.cfg.labelCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("removeCommands should be an array that only contains strings.", () => {
    assert.typeOf(client.cfg.removeCommands, "array");
    client.cfg.removeCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("selfLabelingOnly should be a boolean.", () => {
    assert.isNotNull(client.cfg.selfLabelingOnly);
    assert.typeOf(client.cfg.selfLabelingOnly, "boolean");
  });
  it("commitReferenceEnabled should be a boolean.", () => {
    assert.isNotNull(client.cfg.commitReferenceEnabled);
    assert.typeOf(client.cfg.commitReferenceEnabled, "boolean");
  });
  it("clearClosedIssues should be a boolean.", () => {
    assert.isNotNull(client.cfg.clearClosedIssues);
    assert.typeOf(client.cfg.clearClosedIssues, "boolean");
  });
  it("checkMergeConflicts should be a boolean.", () => {
    assert.isNotNull(client.cfg.checkMergeConflicts);
    assert.typeOf(client.cfg.checkMergeConflicts, "boolean");
  });
  it("repoEventsDelay should be a postive integer if it is defined.", () => {
    if (client.cfg.repoEventsDelay) {
      assert(Number.isInteger(client.cfg.repoEventsDelay) > 0);
    } else {
      assert.isUndefined(client.cfg.repoEventsDelay);
    }
  });
  it("areaLabels should be a map if it is defined.", () => {
    if (client.cfg.areaLabels) assert.typeOf(client.cfg.areaLabels, "map");
    else assert.isUndefined(client.cfg.areaLabels);
  });
  it("addCollabPermission should be a valid string if it is defined.", () => {
    const permissions = ["pull", "push", "admin"];
    if (client.cfg.addCollabPermission) {
      assert(permissions.includes(client.cfg.addCollabPermission));
    } else {
      assert.isUndefined(client.cfg.addCollabPermission);
    }
  });
  it("escapeWIPString should be a string if it is defined.", () => {
    if (client.cfg.escapeWIPString) assert.typeOf(client.cfg.escapeWIPString, "string");
    else assert.isUndefined(client.cfg.escapeWIPString);
  });
  it("activeRepos should be an array of properly-formatted strings.", () => {
    assert.typeOf(client.cfg.activeRepos, "array");
    client.cfg.activeRepos.forEach((repo) => {
      assert.typeOf(repo, "string");
      assert.include(repo, "/", "Repositories are in format repoOwner/repoName");
    });
  });
  it("checkInactivityTimeout should be a postive integer if it is defined.", () => {
    if (client.cfg.checkInactivityTimeout) {
      assert(Number.isInteger(client.cfg.checkInactivityTimeout) > 0);
    } else {
      assert.isUndefined(client.cfg.checkInactivityTimeout);
    }
  });
  it("inactivityTimeLimit should be a postive integer if it is defined.", () => {
    if (client.cfg.activityTimeLimit) {
      assert(Number.isInteger(client.cfg.activityTimeLimit) > 0);
    } else {
      assert.isUndefined(client.cfg.activityTimeLimit);
    }
  });
  it("autoAbandonTimeLimit should be a postive integer if it is defined.", () => {
    if (client.cfg.autoAbandonTimeLimit) {
      assert(Number.isInteger(client.cfg.autoAbandonTimeLimit) > 0);
    } else {
      assert.isUndefined(client.cfg.autoAbandonTimeLimit);
    }
  });
  it("travisLabel should be a string if it is defined.", () => {
    if (client.cfg.travisLabel) assert.typeOf(client.cfg.travisLabel, "string");
    else assert.isUndefined(client.cfg.travisLabel);
  });
  it("inProgressLabel should be a string if it is defined.", () => {
    if (client.cfg.inProgressLabel) assert.typeOf(client.cfg.inProgressLabel, "string");
    else assert.isUndefined(client.cfg.inProgressLabel);
  });
  it("inactiveLabel should be a string if it is defined.", () => {
    if (client.cfg.activeLabel) assert.typeOf(client.cfg.activeLabel, "string");
    else assert.isUndefined(client.cfg.activeLabel);
  });
  it("reviewedLabel should be a string if it is defined.", () => {
    if (client.cfg.reviewedLabel) assert.typeOf(client.cfg.reviewedLabel, "string");
    else assert.isUndefined(client.cfg.reviewedLabel);
  });
  it("needsReviewLabel should be a string if it is defined.", () => {
    if (client.cfg.needsReviewLabel) assert.typeOf(client.cfg.needsReviewLabel, "string");
    else assert.isUndefined(client.cfg.needsReviewLabel);
  });
  it("priorityLabels should be an array of properly-formatted strings.", () => {
    assert.typeOf(client.cfg.priorityLabels, "array");
    client.cfg.priorityLabels.forEach((repo) => {
      assert.typeOf(repo, "string");
    });
  });
  it("pullRequestsAssignee should be a boolean.", () => {
    assert.isNotNull(client.cfg.pullRequestsAssignee);
    assert.typeOf(client.cfg.pullRequestsAssignee, "boolean");
  });
});
