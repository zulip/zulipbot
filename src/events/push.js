exports.run = (client, payload) => {
  const repository = payload.repository;
  if (payload.ref !== "refs/heads/master" || !client.cfg.checkMergeConflicts) return;
  setTimeout(() => {
    client.automations.get("checkMergeConflicts").run(client, repository);
  }, client.cfg.repoEventsDelay);
};

exports.events = ["push"];
