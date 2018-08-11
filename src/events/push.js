exports.run = function(payload) {
  const repo = payload.repository;
  const masterPush = payload.ref === "refs/heads/master";
  const {label, comment} = this.cfg.pulls.status.mergeConflicts;

  if (!masterPush || (!label && !comment)) return this.util.respond(false);

  return this.util.respond(setTimeout(() => {
    this.responses.get("mergeConflict").run(repo);
  }, this.cfg.eventsDelay * 60 * 1000));
};

exports.events = ["push"];
