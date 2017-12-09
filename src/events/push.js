exports.run = (client, payload) => {
  const repository = payload.repository;
  const masterPush = payload.ref === "refs/heads/master";

  if (!masterPush || !client.cfg.pullRequests.mergeConflicts) {
    return;
  }

  setTimeout(() => {
    client.automations.get("checkMergeConflicts").run(client, repository);
  }, client.cfg.eventsDelay * 60 * 1000);
};

exports.events = ["push"];
