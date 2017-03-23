"use strict";

const assert = require("chai").assert;
const cfg = require("../src/config.js"); // config file

describe("config.js lint", function() {
  it("claimCommands should be an array that only contains strings.", function() {
    assert.typeOf(cfg.claimCommands, "array");
    cfg.claimCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("abandonCommands should be an array that only contains strings.", function() {
    assert.typeOf(cfg.abandonCommands, "array");
    cfg.abandonCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("labelCommands should be an array that only contains strings.", function() {
    assert.typeOf(cfg.labelCommands, "array");
    cfg.labelCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("removeCommands should be an array that only contains strings.", function() {
    assert.typeOf(cfg.removeCommands, "array");
    cfg.removeCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("selfLabelingOnly should be a boolean.", function() {
    assert.isNotNull(cfg.selfLabelingOnly);
    assert.typeOf(cfg.selfLabelingOnly, "boolean");
  });
  it("joinCommands should be an array that only contains strings.", function() {
    assert.typeOf(cfg.joinCommands, "array");
    cfg.joinCommands.forEach((command) => {
      assert.typeOf(command, "string");
    });
  });
  it("areaLabels should be a map if it is defined.", function() {
    if (cfg.areaLabels) assert.typeOf(cfg.areaLabels, "map");
    else assert.isUndefined(cfg.areaLabels);
  });
  it("addCollabPermission should be a valid string if it is defined.", function() {
    const permissions = ["pull", "push", "admin"];
    if (cfg.addCollabPermission) assert(permissions.includes(cfg.addCollabPermission));
    else assert.isUndefined(cfg.addCollabPermission);
  });
  it("escapeWIPString should be a string if it is defined.", function() {
    if (cfg.escapeWIPString) assert.typeOf(cfg.escapeWIPString, "string");
    else assert.isUndefined(cfg.escapeWIPString);
  });
  it("checkInactivityTimeout should be a postive integer if it is defined.", function() {
    if (cfg.checkInactivityTimeout) assert(!isNaN(parseFloat(cfg.checkInactivityTimeout)) && isFinite(cfg.checkInactivityTimeout));
    else assert.isUndefined(cfg.checkInactivityTimeout);
  });
  it("inactivityTimeLimit should be a postive integer if it is defined.", function() {
    if (cfg.inactivityTimeLimit) assert(!isNaN(parseFloat(cfg.inactivityTimeLimit)) && isFinite(cfg.inactivityTimeLimit));
    else assert.isUndefined(cfg.inactivityTimeLimit);
  });
  it("autoAbandonTimeLimit should be a postive integer if it is defined.", function() {
    if (cfg.autoAbandonTimeLimit) assert(!isNaN(parseFloat(cfg.autoAbandonTimeLimit)) && isFinite(cfg.autoAbandonTimeLimit));
    else assert.isUndefined(cfg.autoAbandonTimeLimit);
  });
  it("travisLabel should be a string if it is defined.", function() {
    if (cfg.travisLabel) assert.typeOf(cfg.travisLabel, "string");
    else assert.isUndefined(cfg.travisLabel);
  });
  it("inProgressLabel should be a string if it is defined.", function() {
    if (cfg.inProgressLabel) assert.typeOf(cfg.inProgressLabel, "string");
    else assert.isUndefined(cfg.inProgressLabel);
  });
  it("inactiveLabel should be a string if it is defined.", function() {
    if (cfg.inactiveLabel) assert.typeOf(cfg.inactiveLabel, "string");
    else assert.isUndefined(cfg.inactiveLabel);
  });
  it("reviewedLabel should be a string if it is defined.", function() {
    if (cfg.reviewedLabel) assert.typeOf(cfg.reviewedLabel, "string");
    else assert.isUndefined(cfg.reviewedLabel);
  });
  it("needsReviewLabel should be a string if it is defined.", function() {
    if (cfg.needsReviewLabel) assert.typeOf(cfg.needsReviewLabel, "string");
    else assert.isUndefined(cfg.needsReviewLabel);
  });
});
