exports.run = function(payload) {
  const repository = payload.repository;
  const masterPush = payload.ref === "refs/heads/master";

  if (!masterPush || !this.cfg.pulls.status.mergeConflicts) {
    return;
  }

  setTimeout(() => {
    this.automations.get("checkMergeConflicts").run(repository);
  }, this.cfg.eventsDelay * 60 * 1000);
};

exports.events = ["push"];
