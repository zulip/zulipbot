exports.run = (client, payload) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  const l = payload.label;

  if (client.cfg.activity.issues.inProgress) {
    client.automations.get("issueState").progress(client, payload, repository);
  }

  if (action === "labeled") {
    client.automations.get("areaLabel").run(client, issue, repository, l);
  } else if (action === "closed" && client.cfg.activity.issues.clearClosed) {
    client.automations.get("issueState").close(client, issue, repository);
  } else if (action === "reopened") {
    client.automations.get("issueState").reopen(issue);
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

exports.events = ["issues", "issue_comment"];
