exports.run = async function(payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pullRequests.reviewed.assignee;
  const ref = this.cfg.pullRequests.references.required;
  const check = this.cfg.activity.check.repositories.includes(repo.full_name);
  const autoUpdate = this.cfg.activity.pullRequests.autoUpdate;
  const size = this.cfg.pullRequests.status.size;

  if (check && (autoUpdate || size)) {
    this.automations.get("pullRequestState").label(payload);
  }

  if (action === "submitted" && assignee) {
    this.automations.get("pullRequestState").assign(payload);
  } else if (action === "labeled" && this.cfg.issues.area.labels) {
    const l = payload.label;
    const issue = await this.issues.get({
      owner: repo.owner.login, repo: repo.name, number: pull.number
    });
    this.automations.get("areaLabel").run(issue.data, repo, l);
  }

  if (!ref || pull.title.includes(this.cfg.pullRequests.status.wip)) return;

  if (action === "opened") {
    this.automations.get("issueReferenced").run(pull, repo, true);
  } else if (action === "synchronize") {
    this.automations.get("issueReferenced").run(pull, repo, false);
  }
};

exports.events = ["pull_request", "pull_request_review"];
