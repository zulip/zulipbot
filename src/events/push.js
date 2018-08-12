exports.run = function(payload) {
  const repo = payload.repository;
  const masterPush = payload.ref === "refs/heads/master";

  if (!masterPush || !this.cfg.pulls.status.mergeConflicts) {
    return;
  }

  setTimeout(() => {
    this.responses.get("mergeConflict").run(repo);
  }, this.cfg.eventsDelay * 60 * 1000);
};

exports.events = ["push"];
