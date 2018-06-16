exports.run = async function(payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pulls.reviewed.assignee;
  const ref = this.cfg.pulls.references.required;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const size = this.cfg.pulls.status.size;

  if (autoUpdate || size) {
    await this.automations.get("pullState").label(payload);
  }

  if (action === "submitted" && assignee) {
    this.automations.get("pullState").assign(payload);
  } else if (action === "labeled" && this.cfg.issues.area.labels) {
    const l = payload.label;
    const issue = await this.issues.get({
      owner: repo.owner.login, repo: repo.name, number: pull.number
    });
    this.automations.get("areaLabel").run(issue.data, repo, l);
  }

  if (!ref || pull.title.includes(this.cfg.pulls.status.wip)) return;

  if (action === "opened") {
    this.automations.get("reference").run(pull, repo, true);
  } else if (action === "synchronize") {
    this.automations.get("reference").run(pull, repo, false);
  }
};

exports.events = ["pull_request", "pull_request_review"];
