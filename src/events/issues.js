const recentlyClosed = new Map();

exports.run = (client, payload) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  if (client.cfg.inProgressLabel) {
    exports.cleanInProgress(client, action, issue, repository);
  }
  if (action === "labeled" && client.cfg.areaLabels) {
    return client.automations.get("areaLabel").run(client, issue, repository, payload.label);
  } else if (action === "closed" && issue.assignees.length && client.cfg.clearClosedIssues) {
    recentlyClosed.set(issue.id, issue);
    return setTimeout(() => {
      if (recentlyClosed.has(issue.id)) {
        const assignees = issue.assignees.map(a => a.login);
        client.abandonIssue(client, assignees, repository, issue);
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
  const commenter = payloadBody.user.login;
  const body = payloadBody.body;
  const issueCreator = issue.user.login;
  if (commenter === client.cfg.username || !body) return;
  const parseCommands = body.match(new RegExp("@" + client.cfg.username + "\\s(\\w*)", "g"));
  if (!parseCommands) return;
  parseCommands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    let cmdFile = client.commands.get(command.split(" ")[1]);
    if (cmdFile && !cmdFile.args) return cmdFile.run(client, payloadBody, issue, repository);
    else if (!cmdFile || !body.match(/".*?"/g)) return;
    if (client.cfg.selfLabelingOnly && commenter !== issueCreator && !client.cfg.sudoUsers.includes(commenter)) return;
    const splitBody = body.split(`@${client.cfg.username}`).filter((splitString) => {
      return splitString.includes(` ${command.split(" ")[1]} "`);
    }).join(" ");
    cmdFile.run(client, splitBody, issue, repository);
  });
};

exports.closeIssue = (client, issue, repository) => {
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const assignees = issue.assignees.map(a => a.login);
  client.commands.get("abandon").abandon(client, assignees, repoOwner, repoName, issueNumber);
};

exports.cleanInProgress = (client, action, issue, repository) => {
  const labeled = issue.labels.find(label => label.name === client.cfg.inProgressLabel);
  if (action === "assigned" && !labeled) {
    client.issues.addLabel({
      owner: repository.owner.login, repo: repository.name, number: issue.number, name: client.cfg.inProgressLabel
    });
  } else if (action === "unassigned" && !issue.assignees.length && labeled) {
    client.issues.removeLabel({
      owner: repository.owner.login, repo: repository.name, number: issue.number, name: client.cfg.inProgressLabel
    });
  } else if (issue.assignees.length && !labeled) {
    const comment = "**ERROR:** This issue has been assigned but is not labeled as being in progress.";
    client.newComment(issue, repository, comment);
  }
};

exports.events = ["issues", "issue_comment"];
