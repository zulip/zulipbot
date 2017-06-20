const GitHub = require("github");
const client = new GitHub();
client.cfg = require("./config.js");
client.zulip = require("zulip-js")(client.cfg.zulip);

client.authenticate({ // Authentication
  type: "basic",
  username: client.cfg.username,
  password: client.cfg.password
});

client.send = (msg, topic) => {
  const params = {
    to: client.cfg.defaultStream,
    type: "stream",
    subject: topic,
    content: msg
  };
  client.zulip.messages.send(params);
};

module.exports = client;
