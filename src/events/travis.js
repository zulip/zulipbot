exports.run = async function(payload) {
  if (!payload.pull_request || !this.cfg.pulls.ci.travis) {
    return this.util.respond(false);
  }

  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const number = payload.pull_request_number;

  const labels = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  const labelCheck = labels.data.find(label => {
    return label.name === this.cfg.pulls.ci.travis;
  });

  if (!labelCheck) return this.util.respond(false);

  const state = payload.state;
  const url = payload.build_url;
  let comment;

  if (state === "passed") {
    comment = this.templates.get("travisPass").format({url});
  } else {
    comment = this.templates.get("travisFail").format({
      buildLogs: `[build logs](${url})`, state: state
    });
  }

  return this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: comment
  });
};

exports.events = ["travis"];
