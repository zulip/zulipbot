exports.run = async function(client, payload) {
  if (!payload.pull_request || !client.cfg.travisLabel) return;

  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const number = payload.pull_request_number;

  const labels = await client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  const labelCheck = labels.data.find(label => {
    return label.name === client.cfg.travisLabel;
  });

  if (!labelCheck) return;

  const repository = {name: repoName, owner: {login: repoOwner}};
  const state = payload.state;
  const buildURL = payload.build_url;
  let comment = "(unknown state)";

  if (state === "passed") {
    comment = client.templates.get("travisPassed").replace("[url]", buildURL);
  } else if (state === "failed" || state === "errored") {
    comment = client.templates.get("travisFailed")
      .replace("[state]", state)
      .replace("[build logs]", buildURL || "build logs");
  }

  client.newComment({number: number}, repository, comment);
};

exports.events = ["travis"];
