exports.run = async function(client, payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const pullCfg = client.cfg.activity.pullRequests;
  const ref = client.cfg.issues.area.commitReferences;
  const wip = client.cfg.pullRequests.wip;
  const check = client.cfg.activity.check.repositories.includes(repo.full_name);
  const update = pullCfg.autoUpdate;

  if (pullCfg.reviewed.label && pullCfg.needsReview.label && check && update) {
    client.automations.get("pullRequestState").review(client, payload);
  }

  if (action === "submitted" && pullCfg.reviewed.assignee) {
    client.automations.get("pullRequestState").assign(client, payload);
  } else if (action === "labeled" && client.cfg.issues.area.labels) {
    const l = payload.label;
    const issue = await client.issues.get({
      owner: repo.owner.login, repo: repo.name, number: pull.number
    });
    client.automations.get("areaLabel").run(client, issue.data, repo, l);
  }

  if (!ref || pull.title.includes(wip)) return;

  if (action === "opened") {
    client.automations.get("issueReferenced").run(client, pull, repo, true);
  } else if (action === "synchronize") {
    client.automations.get("issueReferenced").run(client, pull, repo, false);
  }
};

exports.events = ["pull_request", "pull_request_review"];
