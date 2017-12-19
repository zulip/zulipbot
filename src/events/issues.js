const recentlyClosed = new Map();

exports.run = (client, payload) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  const repoOwner = repository.owner.login;
  const repoName = repository.name;
  const l = payload.label;
  const check = client.cfg.activity.issues.pullRequests;

  if (client.cfg.activity.issues.inProgress || check.needsReview.label) {
    exports.cleanInProgress(client, payload, repoOwner, repoName);
  }

  if (action === "labeled") {
    client.automations.get("areaLabel").run(client, issue, repository, l);
  } else if (action === "closed" && client.cfg.activity.issues.clearClosed) {
    recentlyClosed.set(issue.id, issue);
    setTimeout(() => {
      exports.clearClosedIssue(client, issue, repoOwner, repoName);
    }, client.cfg.eventsDelay * 60 * 1000);
  } else if (action === "reopened" && recentlyClosed.has(issue.id)) {
    recentlyClosed.delete(issue.id);
  } else if (action === "opened" || action === "created") {
    exports.parseCommands(client, payloadBody, issue, repository);
  }
};

exports.parseCommands = (client, payloadBody, issue, repository) => {
  const c = payloadBody.user.login;
  const body = payloadBody.body;
  const issueCreator = issue.user.login;

  if (c === client.cfg.auth.username || !body) return;

  const prefix = new RegExp(`@${client.cfg.auth.username}\\s+(\\w+)`, "g");
  const parsedCommands = body.match(prefix);

  if (!parsedCommands) return;

  parsedCommands.forEach(command => {
    const codeBlocks = [`\`\`\`\r\n${command}\r\n\`\`\``, `\`${command}\``];

    if (codeBlocks.some(b => body.includes(b))) return;

    const keyword = command.replace(/\s+/, " ").split(" ")[1];
    let cmdFile = client.commands.get(keyword);

    if (cmdFile && !cmdFile.args) {
      return cmdFile.run(client, payloadBody, issue, repository);
    } else if (!cmdFile || !body.match(/".*?"/g)) {
      return;
    }

    const labelCfg = client.cfg.issues.commands.label.self;
    const op = labelCfg.users ? labelCfg.users.includes(c) : labelCfg;
    if (op && c !== issueCreator) return;

    const splitBody = body.split(`@${client.cfg.auth.username}`).filter(str => {
      return str.match(new RegExp(`\\s+${keyword}\\s+"`));
    }).join(" ");

    cmdFile.run(client, splitBody.replace(/\s+/, " "), issue, repository);
  });
};

exports.clearClosedIssue = (client, issue, repoOwner, repoName) => {
  if (!recentlyClosed.has(issue.id) || !issue.assignees.length) {
    return;
  }

  const assignees = JSON.stringify({
    assignees: issue.assignees.map(a => a.login)
  });

  client.issues.removeAssigneesFromIssue({
    owner: repoOwner, repo: repoName, number: issue.number, body: assignees
  });

  recentlyClosed.delete(issue.id);
};

exports.cleanInProgress = (client, payload, repoOwner, repoName) => {
  const action = payload.action;
  const number = payload.issue.number;
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

exports.events = ["issues", "issue_comment"];
