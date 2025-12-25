import * as responses from "./responses/index.js";

export const run = async function (payload) {
  const action = payload.action;
  const pull = payload.pull_request;
  const repo = payload.repository;
  const assignee = this.cfg.activity.pulls.reviewed.assignee;
  const reference = this.cfg.pulls.references.required;
  const autoUpdate = this.cfg.activity.pulls.autoUpdate;
  const size = this.cfg.pulls.status.size;

  if (autoUpdate || size) {
    await responses.pullState.label.call(this, payload);
  }

  if (action === "submitted" && assignee) {
    responses.pullState.assign.call(this, payload);
  } else if (["labeled", "unlabeled"].includes(action)) {
    const l = payload.label;
    const issue = await this.issues.get({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pull.number,
    });
    await responses.areaLabel.run.call(this, issue.data, repo, l);
  }

  if (!reference || pull.title.includes(this.cfg.pulls.status.wip)) return;

  if (action === "opened") {
    await responses.reference.run.call(this, pull, repo, true);
  } else if (action === "synchronize") {
    await responses.reference.run.call(this, pull, repo, false);
    await responses.pullState.update.call(this, pull, repo);
  }
};

export const events = ["pull_request", "pull_request_review"];
