"use strict";

const test = require("tap").test;

const client = require("../../../src/client.js");
const push = require("../../../src/events/push.js");

const payload = {
  ref: "refs/heads/branch",
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
};

test("Ignore if non-main branch was pushed", async (t) => {
  const response = await push.run.call(client, payload);

  t.notOk(response);

  t.end();
});

test("Ignore if there was no merge conflict configuration", async (t) => {
  client.cfg.pulls.status.mergeConflicts.comment = false;
  client.cfg.pulls.status.mergeConflicts.label = null;
  payload.ref = "refs/heads/main";
  const response = await push.run.call(client, payload);

  t.notOk(response);

  t.end();
});

test("Trigger events if main branch was pushed", async (t) => {
  client.cfg.eventsDelay = 0;
  client.cfg.pulls.status.mergeConflicts.comment = true;
  client.responses.set("mergeConflict", {
    run: () => {},
  });

  const response = await push.run.call(client, payload);

  t.type(response, "Timeout");

  t.end();
});
