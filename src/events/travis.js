exports.run = async function(payload) {
  if (!payload.pull_request || !this.cfg.pullRequests.ci.travis) return;

  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const number = payload.pull_request_number;

  const labels = await this.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  const labelCheck = labels.data.find(label => {
    return label.name === this.cfg.pullRequests.ci.travis;
  });

  if (!labelCheck) return;

  const state = payload.state;
  const buildURL = payload.build_url;
  let comment = "(unknown state)";

  if (state === "passed") {
    comment = this.templates.get("travisPassed")
      .replace(new RegExp("{url}", "g"), buildURL);
  } else if (state === "failed" || state === "errored") {
    comment = this.templates.get("travisFailed")
      .replace(new RegExp("{state}", "g"), state)
      .replace(new RegExp("{build logs}", "g"), buildURL || "build logs");
  }

  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: comment
  });
};

exports.events = ["travis"];
