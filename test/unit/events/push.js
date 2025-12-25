import timers from "node:timers";

import nock from "nock";
import { test } from "tap";

import client from "../../../src/client.js";
import * as push from "../../../src/events/push.js";

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
});

test("Ignore if there was no merge conflict configuration", async (t) => {
  client.cfg.pulls.status.mergeConflicts.comment = false;
  client.cfg.pulls.status.mergeConflicts.label = null;
  payload.ref = "refs/heads/main";
  const response = await push.run.call(client, payload);

  t.notOk(response);
});

test("Trigger events if main branch was pushed", async (t) => {
  client.cfg.eventsDelay = 0;
  client.cfg.pulls.status.mergeConflicts.comment = true;
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls")
    .reply(200, []);

  const response = await push.run.call(client, payload);
  await timers.promises.setTimeout(0);

  scope.done();

  t.type(response, "Timeout");
});
