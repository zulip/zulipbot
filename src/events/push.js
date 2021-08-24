"use strict";

exports.run = function (payload) {
  const repo = payload.repository;
  const { branch, label, comment } = this.cfg.pulls.status.mergeConflicts;
  const masterPush = payload.ref === `refs/heads/${branch}`;

  if (!masterPush || (!label && !comment)) return;

  return setTimeout(() => {
    this.responses.get("mergeConflict").run(repo);
  }, this.cfg.eventsDelay * 60 * 1000);
};

exports.events = ["push"];
