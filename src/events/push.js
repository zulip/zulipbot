exports.run = function(payload) {
  const repository = payload.repository;
  const masterPush = payload.ref === "refs/heads/master";

  if (!masterPush || !this.cfg.pullRequests.mergeConflicts) {
    return;
  }

  setTimeout(() => {
    this.automations.get("checkMergeConflicts").run(this, repository);
  }, this.cfg.eventsDelay * 60 * 1000);
};

exports.events = ["push"];
