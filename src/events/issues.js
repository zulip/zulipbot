const recentlyClosed = new Map();

exports.run = (client, payload) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  if (client.cfg.inProgressLabel) {
    exports.cleanInProgress(client, payload, repoOwner, repoName);
  }
  if (action === "labeled" && client.cfg.areaLabels) {
    return client.automations.get("areaLabel").run(client, issue, repository, payload.label);
  } else if (action === "closed" && issue.assignees.length && client.cfg.clearClosedIssues) {
    recentlyClosed.set(issue.id, issue);
    return setTimeout(() => {
      if (recentlyClosed.has(issue.id)) {
        const assignees = JSON.stringify({
          assignees: issue.assignees.map(a => a.login)
        });
        client.issues.removeAssigneesFromIssue({
          owner: repoOwner, repo: repoName, number: issue.number, body: assignees
        });
      }
      recentlyClosed.delete(issue.id);
    }, client.cfg.repoEventsDelay * 60 * 1000);
  } else if (action === "reopened" && recentlyClosed.has(issue.id)) {
    return recentlyClosed.delete(issue.id);
  } else if (action === "opened" || action === "created") {
    exports.parseCommands(client, payloadBody, issue, repository);
  }
};

exports.parseCommands = (client, payloadBody, issue, repository) => {
  const c = payloadBody.user.login;
  const body = payloadBody.body;
  const issueCreator = issue.user.login;
  if (c === client.cfg.username || !body) return;
  const parseCommands = body.match(new RegExp(`@${client.cfg.username}\\s+(\\S+)`, "g"));
  if (!parseCommands) return;
  parseCommands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    const keyword = command.replace(/\s+/, " ").split(" ")[1];
    let cmdFile = client.commands.get(keyword);
    if (cmdFile && !cmdFile.args) return cmdFile.run(client, payloadBody, issue, repository);
    else if (!cmdFile || !body.match(/".*?"/g)) return;
    if (client.cfg.selfLabelingOnly && c !== issueCreator && !client.cfg.sudoUsers.includes(c)) return;
    const splitBody = body.split(`@${client.cfg.username}`).filter((splitString) => {
      return splitString.match(new RegExp(`\\s+${keyword}\\s+"`));
    }).join(" ");
    cmdFile.run(client, splitBody.replace(/\s+/, " "), issue, repository);
  });
};

exports.cleanInProgress = (client, payload, repoOwner, repoName) => {
  const action = payload.action;
  const issue = payload.issue;
  const labeled = issue.labels.find(label => label.name === client.cfg.inProgressLabel);
  if (action === "assigned" && !labeled) {
    client.issues.addLabels({
      owner: repoOwner, repo: repoName, number: issue.number, labels: [client.cfg.inProgressLabel]
    });
  } else if (action === "unassigned" && !issue.assignees.length && labeled) {
    client.issues.removeLabel({
      owner: repoOwner, repo: repoName, number: issue.number, name: client.cfg.inProgressLabel
    });
  }
};

exports.events = ["issues", "issue_comment"];
