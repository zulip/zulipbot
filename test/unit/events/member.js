"use strict";

const nock = require("nock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const member = require("../../../src/events/member.js");

const payload = {
  action: "removed",
  repository: {
    full_name: "zulip/zulipbot",
  },
  member: {
    login: "octokitten",
  },
};

test("Ignore if payload action isn't added", async (t) => {
  const response = await member.run.call(client, payload);

  t.notOk(response);
});

test("Ignore if there aren't any claim command aliases", async (t) => {
  payload.action = "added";
  client.cfg.issues.commands.assign.claim = [];
  const response = await member.run.call(client, payload);

  t.notOk(response);
});

test("Ignore if there aren't any recorded invites", async (t) => {
  client.cfg.issues.commands.assign.claim = ["claim"];
  const response = await member.run.call(client, payload);

  t.notOk(response);
});

test("Assign successfully if invite was found", async (t) => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octokitten"],
    })
    .reply(200, { assignees: ["octokitten"] });

  const response = await member.run.call(client, payload);

  t.notOk(client.invites.has("octokitten@zulip/zulipbot"));
  t.ok(response);

  scope.done();
});

test("Warn if issue assignment failed", async (t) => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octokitten"],
    })
    .reply(200, { assignees: [] })
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await member.run.call(client, payload);

  t.notOk(client.invites.has("octokitten@zulip/zulipbot"));

  scope.done();
});
