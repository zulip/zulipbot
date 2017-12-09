exports.run = async function(client, pullRequest, repository, opened) {
  const author = pullRequest.user.login;
  const number = pullRequest.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;

  const response = await client.pullRequests.getCommits({
    owner: repoOwner, repo: repoName, number: number
  });
  const refIssues = response.data.filter(c => {
    return exports.findKeywords(c.commit.message);
  }).map(c => c.commit.message.match(/#([0-9]+)/)[1]);

  if (!refIssues.length && exports.findKeywords(pullRequest.body)) {
    const comment = client.templates.get("fixCommitMessage")
      .replace("[author]", author);
    return client.newComment(pullRequest, repository, comment);
  }

  if (!opened) return;

  Array.from(new Set(refIssues)).forEach(referencedIssue => {
    exports.referenceIssue(client, referencedIssue, pullRequest, repository);
  });
};

exports.referenceIssue = async function(client, refIssue, pullRequest, repo) {
  const repoName = repo.name;
  const repoOwner = repo.owner.login;

  const labels = await client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: refIssue
  });
  const issueLabels = labels.data.filter(l => {
    return client.cfg.issues.area.labels.has(l.name);
  }).map(l => l.name);

  const teams = issueLabels.map(l => client.cfg.issues.area.labels.get(l));

  if (!teams.length) return;

  // Create unique array of teams (labels can point to same team)
  const unique = Array.from(new Set(teams));

  const uniqueTeams = `@${repoOwner}/` + unique.join(`, @${repoOwner}/`);
  const areaLabels = issueLabels.join("\", \"");

  const labelSize = issueLabels.length === 1 ? "label" : "labels";

  const comment = client.templates.get("areaLabelNotification")
    .replace("[teams]", uniqueTeams)
    .replace("[payload]", "pull request")
    .replace("[refs]", `"${areaLabels}"`)
    .replace("[labels]", labelSize);

  client.newComment(pullRequest, repo, comment);
};

/*
  Keywords from https://help.github.com/articles/closing-issues-using-keywords/
  Referenced issues are only closed when pull requests are merged;
  not necessarily when commits are merged
*/
exports.findKeywords = string => {
  const keywords = ["close", "fix", "resolve"];

  return keywords.some(word => {
    const current = word;
    const past = word.endsWith("e") ? `${word}d` : `${word}ed`;
    const present = word.endsWith("e") ? `${word}s` : `${word}es`;
    const tenses = [current, past, present];

    const matched = tenses.some(t => {
      const regex = new RegExp(`${t} #([0-9]+)`, "i");
      return string.match(regex);
    });

    return matched;
  });
};
