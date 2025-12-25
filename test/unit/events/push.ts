import timers from "node:timers";

import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import { test } from "tap";

import client from "../../../src/client.ts";
import * as push from "../../../src/events/push.ts";

const payload: EmitterWebhookEvent<"push">["payload"] = partialMock({
  ref: "refs/heads/branch",
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
});

void test("Ignore if non-main branch was pushed", async (t) => {
  const response = push.run.call(client, payload);

  t.notOk(response);
});

const mainPayload: EmitterWebhookEvent<"push">["payload"] = partialMock({
  ref: "refs/heads/main",
  repository: payload.repository,
});

void test("Ignore if there was no merge conflict configuration", async (t) => {
  client.cfg.pulls.status.mergeConflicts.comment = false;
  client.cfg.pulls.status.mergeConflicts.label = null;
  const response = push.run.call(client, mainPayload);

  t.notOk(response);
});

void test("Trigger events if main branch was pushed", async (t) => {
  client.cfg.eventsDelay = 0;
  client.cfg.pulls.status.mergeConflicts.comment = true;
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls")
    .reply(200, []);

  const response = push.run.call(client, mainPayload);
  await timers.promises.setTimeout(0);

  scope.done();

  t.type(response, "Timeout");
});
