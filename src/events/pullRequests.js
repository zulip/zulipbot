exports.run = async function(payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const pullCfg = this.cfg.activity.pullRequests;
  const ref = this.cfg.pullRequests.requireReferences;
  const wip = this.cfg.pullRequests.wip;
  const check = this.cfg.activity.check.repositories.includes(repo.full_name);
  const update = pullCfg.autoUpdate;

  if (pullCfg.reviewed.label && pullCfg.needsReview.label && check && update) {
    this.automations.get("pullRequestState").review(payload);
  }

  if (action === "submitted" && pullCfg.reviewed.assignee) {
    this.automations.get("pullRequestState").assign(payload);
  } else if (action === "labeled" && this.cfg.issues.area.labels) {
    const l = payload.label;
    const issue = await this.issues.get({
      owner: repo.owner.login, repo: repo.name, number: pull.number
    });
    this.automations.get("areaLabel").run(issue.data, repo, l);
  }

  if (!ref || pull.title.includes(wip)) return;

  if (action === "opened") {
    this.automations.get("issueReferenced").run(pull, repo, true);
  } else if (action === "synchronize") {
    this.automations.get("issueReferenced").run(pull, repo, false);
  }
};

exports.events = ["pull_request", "pull_request_review"];
