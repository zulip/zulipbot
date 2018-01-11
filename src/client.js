const GitHub = require("github");
const client = new GitHub();
const fs = require("fs");

client.cfg = require("../config/default.js");

client.automations = new Map();
client.commands = new Map();
client.events = new Map();
client.invites = new Map();
client.templates = new Map();

const commands = fs.readdirSync("./src/commands");
for (const file of commands) {
  const data = require(`./commands/${file}`);
  for (let i = data.aliases.length; i--;) {
    client.commands.set(data.aliases[i], data);
  }
}

const templates = fs.readdirSync("./src/templates");
for (const file of templates) {
  const text = fs.readFileSync(`./src/templates/${file}`, "utf8");
  client.templates.set(file.slice(0, -3), text);
}

const events = fs.readdirSync("./src/events");
for (const event of events) {
  const data = require(`./events/${event}`);
  for (let i = data.events.length; i--;) {
    client.events.set(data.events[i], data.run.bind(client));
  }
}

const automations = fs.readdirSync("./src/automations");
for (const file of automations) {
  const data = require(`./automations/${file}`);
  client.automations.set(file.slice(0, -3), data);
}

client.authenticate({
  type: "basic",
  username: client.cfg.auth.username,
  password: client.cfg.auth.password
});

client.getAll = async function(page) {
  let response = page;
  let responses = response.data;
  while (this.hasNextPage(response)) {
    response = await this.getNextPage(response);
    responses = responses.concat(response.data);
  }
  return new Promise(resolve => resolve(responses));
};

/*
  Keywords from https://help.github.com/articles/closing-issues-using-keywords/
  Referenced issues are only closed when pull requests are merged;
  not necessarily when commits are merged
*/
client.findKeywords = string => {
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

module.exports = client;
