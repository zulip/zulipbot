import { test, type TestContext } from "node:test";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import client from "../../../src/client.ts";
import * as member from "../../../src/events/member.ts";

const payload: EmitterWebhookEvent<"member">["payload"] = partialMock({
  action: "removed",
  repository: {
    full_name: "zulip/zulipbot",
  },
  member: {
    login: "octokitten",
  },
});

void test("member: Ignore if payload action isn't added", async (t: TestContext) => {
  const response = await member.run.call(client, payload);

  t.assert.strictEqual(response, undefined);
});

const payload2: EmitterWebhookEvent<"member">["payload"] = partialMock({
  action: "added",
  repository: payload.repository,
  member: payload.member,
});

void test("member: Ignore if there aren't any claim command aliases", async (t: TestContext) => {
  client.cfg.issues.commands.assign.claim = [];
  const response = await member.run.call(client, payload2);

  t.assert.strictEqual(response, undefined);
});

void test("member: Ignore if there aren't any recorded invites", async (t: TestContext) => {
  client.cfg.issues.commands.assign.claim = ["claim"];
  const response = await member.run.call(client, payload2);

  t.assert.strictEqual(response, undefined);
});

void test("member: Assign successfully if invite was found", async (t: TestContext) => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octokitten"],
    })
    .reply(200, { assignees: ["octokitten"] });

  const response = await member.run.call(client, payload2);

  t.assert.ok(!client.invites.has("octokitten@zulip/zulipbot"));
  t.assert.strictEqual(response, true);

  scope.done();
});

void test("member: Warn if issue assignment failed", async (t: TestContext) => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octokitten"],
    })
    .reply(200, { assignees: [] })
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await member.run.call(client, payload2);

  t.assert.ok(!client.invites.has("octokitten@zulip/zulipbot"));

  scope.done();
});
