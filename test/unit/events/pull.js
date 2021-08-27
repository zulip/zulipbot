"use strict";

const nock = require("nock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const pull = require("../../../src/events/pull.js");

const payload = {
  action: "opened",
  pull_request: {
    number: 69,
    title: "Fix all the bugs",
    user: { login: "octocat" },
    body: null,
  },

  repository: {
    owner: { login: "zulip" },
    name: "zulipbot",
  },
};

test("Ignore empty body", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, [{ name: "enhancement" }])
    .get("/repos/zulip/zulipbot/pulls/69/files")
    .reply(200, [])
    .put("/repos/zulip/zulipbot/issues/69/labels", {
      labels: ["enhancement", "size: XS"],
    })
    .reply(200)
    .get("/repos/zulip/zulipbot/pulls/69/commits")
    .reply(200, [{ commit: { message: "Fix all the bugs" } }])
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, []);
  await pull.run.call(client, payload);

  scope.done();
});
