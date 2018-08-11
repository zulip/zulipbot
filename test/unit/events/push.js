const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const push = require(`${homePath}/events/push.js`);

const payload = {
  ref: "refs/heads/branch",
  repository: {
    owner: {
      login: "zulip"
    },
    name: "zulipbot"
  }
};

test("Ignore if non-master branch was pushed", async t => {
  const response = await push.run.call(client, payload);

  t.equals(response, false);

  t.end();
});

test("Ignore if there was no merge conflict configuration", async t => {
  client.cfg.pulls.status.mergeConflicts.comment = false;
  client.cfg.pulls.status.mergeConflicts.label = null;
  payload.ref = "refs/heads/master";
  const response = await push.run.call(client, payload);

  t.equals(response, false);

  t.end();
});

test("Trigger events if master branch was pushed", async t => {
  client.cfg.eventsDelay = 0;
  client.cfg.pulls.status.mergeConflicts.comment = true;
  client.responses.set("mergeConflict", {
    run: () => {}
  });

  const response = await push.run.call(client, payload);

  t.type(response, "Timeout");

  t.end();
});
