const recentlyClosed = new Map();

exports.close = (client, issue, repository) => {
  recentlyClosed.set(issue.id, issue);

  setTimeout(() => {
    exports.clearClosed(client, issue, repository);
  }, client.cfg.eventsDelay * 60 * 1000);
};

exports.reopen = issue => {
  if (recentlyClosed.has(issue.id)) recentlyClosed.delete(issue.id);
};

exports.clearClosed = async function(client, issue, repository) {
  const repoOwner = repository.owner.login;
  const repoName = repository.name;

  if (!recentlyClosed.has(issue.id) || !issue.assignees.length) {
    return;
  }

  const assignees = JSON.stringify({
    assignees: issue.assignees.map(a => a.login)
  });

  await client.issues.removeAssigneesFromIssue({
    owner: repoOwner, repo: repoName, number: issue.number, body: assignees
  });

  recentlyClosed.delete(issue.id);
};

exports.progress = (client, payload, repository) => {
  const action = payload.action;
  const number = payload.issue.number;
  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  const label = client.cfg.activity.issues.inProgress;
  const assignees = payload.issue.assignees.length;
  const labeled = payload.issue.labels.find(l => {
    return l.name === label;
  });

  if (action === "assigned" && !labeled) {
    client.issues.addLabels({
      owner: repoOwner, repo: repoName, number: number, labels: [label]
    });
  } else if (action === "unassigned" && !assignees && labeled) {
    client.issues.removeLabel({
      owner: repoOwner, repo: repoName, number: number, name: label
    });
  }
};
