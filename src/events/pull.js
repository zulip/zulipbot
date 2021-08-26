"use strict";

exports.run = async function (payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pulls.reviewed.assignee;
  const reference = this.cfg.pulls.references.required;
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
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pull.number,
    });
    await this.responses.get("areaLabel").run(issue.data, repo, l);
  }

  if (!reference || pull.title.includes(this.cfg.pulls.status.wip)) return;

  if (action === "opened") {
    await this.responses.get("reference").run(pull, repo, true);
  } else if (action === "synchronize") {
    await this.responses.get("reference").run(pull, repo, false);
    await this.responses.get("pullState").update(pull, repo);
  }
};

exports.events = ["pull_request", "pull_request_review"];
