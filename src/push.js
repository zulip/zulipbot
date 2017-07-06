exports.run = (client, payload) => {
  const repository = payload.repository;
  if (payload.ref !== "refs/heads/master" || !client.cfg.checkMergeConflicts) return;
  setTimeout(() => {
    require("./automations/checkMergeConflicts.js").run(client, repository);
  }, client.cfg.repoEventsDelay);
};
