exports.run = function(payload) {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  const label = payload.label;

  if (this.cfg.activity.issues.inProgress) {
    this.automations.get("issueState").progress(payload);
  }

  if (action === "labeled") {
    this.automations.get("areaLabel").run(issue, repository, label);
  } else if (action === "closed" && this.cfg.activity.issues.clearClosed) {
    this.automations.get("issueState").close(issue, repository);
  } else if (action === "reopened") {
    this.automations.get("issueState").reopen(issue);
  } else if (action === "opened" || action === "created") {
    parseCommands.apply(this, [payloadBody, issue, repository]);
  }
};

function parseCommands(payload, issue, repository) {
  const c = payload.user.login;
  const body = payload.body;
  const issueCreator = issue.user.login;

  if (c === this.cfg.auth.username || !body) return;

  const prefix = new RegExp(`@${this.cfg.auth.username}\\s+(\\w+)`, "g");
  const parsedCommands = body.match(prefix);

  if (!parsedCommands) return;

  parsedCommands.forEach(command => {
    const codeBlocks = [`\`\`\`\r\n${command}\r\n\`\`\``, `\`${command}\``];

    if (codeBlocks.some(b => body.includes(b))) return;

    const keyword = command.replace(/\s+/, " ").split(" ")[1];
    let cmdFile = this.commands.get(keyword);

    if (cmdFile && !cmdFile.args) {
      return cmdFile.run.apply(this, [payload, issue, repository]);
    } else if (!cmdFile || !body.match(/".*?"/g)) {
      return;
    }

    const labelCfg = this.cfg.issues.commands.label.self;
    const op = labelCfg.users ? labelCfg.users.includes(c) : labelCfg;
    if (op && c !== issueCreator) return;

    const splitBody = body.split(`@${this.cfg.auth.username}`).filter(str => {
      return str.match(new RegExp(`\\s+${keyword}\\s+"`));
    }).join(" ").replace(/\s+/, " ");

    cmdFile.run.apply(this, [splitBody, issue, repository]);
  });
}

exports.events = ["issues", "issue_comment"];
