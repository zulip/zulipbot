exports.run = async function(payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pulls.reviewed.assignee;
  const ref = this.cfg.pulls.references.required;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const size = this.cfg.pulls.status.size;

  if (autoUpdate || size) {
    await this.responses.get("pullState").label(payload);
  }

  if (action === "submitted" && assignee) {
    this.responses.get("pullState").assign(payload);
  } else if (["labeled", "unlabeled"].includes(action)) {
    const l = payload.label;
    const issue = await this.issues.get({
      owner: repo.owner.login, repo: repo.name, number: pull.number
    });
    this.responses.get("areaLabel").run(issue.data, repo, l);
  }

  if (!ref || pull.title.includes(this.cfg.pulls.status.wip)) return;

  if (action === "opened") {
    this.responses.get("reference").run(pull, repo, true);
  } else if (action === "synchronize") {
    this.responses.get("reference").run(pull, repo, false);
    this.responses.get("pullState").update(pull, repo);
  }
};

exports.events = ["pull_request", "pull_request_review"];
