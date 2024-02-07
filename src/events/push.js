export const run = function (payload) {
  const repo = payload.repository;
  const { branch, label, comment } = this.cfg.pulls.status.mergeConflicts;
  const mainPush = payload.ref === `refs/heads/${branch}`;

  if (!mainPush || (!label && !comment)) return;

  return setTimeout(
    () => {
      this.responses.get("mergeConflict").run(repo);
    },
    this.cfg.eventsDelay * 60 * 1000,
  );
};

export const events = ["push"];
