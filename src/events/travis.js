exports.run = async function(client, payload) {
  if (!payload.pull_request || !client.cfg.pullRequests.travis) return;

  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const number = payload.pull_request_number;

  const labels = await client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  });

  const labelCheck = labels.data.find(label => {
    return label.name === client.cfg.pullRequests.travis;
  });

  if (!labelCheck) return;

  const state = payload.state;
  const buildURL = payload.build_url;
  let comment = "(unknown state)";

  if (state === "passed") {
    comment = client.templates.get("travisPassed")
      .replace(new RegExp("{url}", "g"), buildURL);
  } else if (state === "failed" || state === "errored") {
    comment = client.templates.get("travisFailed")
      .replace(new RegExp("{state}", "g"), state)
      .replace(new RegExp("{build logs}", "g"), buildURL || "build logs");
  }

  client.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: comment
  });
};

exports.events = ["travis"];
