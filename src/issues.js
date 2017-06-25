const fs = require("fs");
const commands = new Map();
const aliases = new Map();

fs.readdir("./src/commands", (err, files) => {
  if (err) return console.error(err);
  for (const file of files) {
    const data = require(`./commands/${file}`);
    commands.set(file.slice(0, -3), data);
    for (let i = data.aliases.length; i--;) aliases.set(data.aliases[i], data.name);
  }
});

exports.run = (client, payload) => {
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  const payloadBody = payload.comment || issue;
  if (action === "labeled" && client.cfg.areaLabels) return require("./issues/areaLabel.js").run(client, issue, repository, payload.label);
  else if (action === "closed") return exports.closeIssue(client, issue, repository);
  else if (action === "opened" || action === "created") exports.parseCommands(client, payloadBody, issue, repository);
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
    let cmdFile = commands.get(aliases.get(command.split(" ")[1]));
    if (cmdFile && !cmdFile.args) return cmdFile.run(client, payloadBody, issue, repository);
    else if (!cmdFile || !body.match(/".*?"/g) || (client.cfg.selfLabelingOnly && commenter !== issueCreator)) return;
    const splitBody = body.split(`@${client.cfg.username}`).filter(splitString => splitString.includes(` ${command.split(" ")[1]} "`)).join(" ");
    cmdFile.run(client, splitBody, issue, repository);
  });
};

exports.closeIssue = (client, issue, repository) => {
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const hasInProgressLabel = issue.labels.find(label => label.name === client.cfg.inProgressLabel);
  if (hasInProgressLabel) client.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: client.cfg.inProgressLabel});
};
