"use strict";

const simple = require("simple-mock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const pull = require("../../../src/events/pull.js");

const payload = {
  action: "opened",
  pull_request: {
    number: 69999,
    title: "Fix all the bugs",
    user: { login: "octocat" },
    body: null,
  },

  repository: {
    owner: { login: "zulip" },
    name: "zulipbot",
  },
};

const repoLabels = [{ name: "test" }, { name: "test2" }, { name: "bug" }];

test("Ignore empty body", async (t) => {
  const request1 = simple
    .mock(client.util, "getAllPages")
    .resolveWith(repoLabels)
    .resolveWith([]);
  const request2 = simple
    .mock(client.issues, "listLabelsOnIssue")
    .resolveWith({ data: [{ name: "enhancement" }] });
  const request3 = simple.mock(client.issues, "replaceLabels").resolveWith();
  const request4 = simple.mock(client.pulls, "listCommits").resolveWith({
    data: [{ commit: { message: "Fix all the bugs" } }],
  });

  await pull.run.call(client, payload);

  t.ok(request1.called);
  t.ok(request2.called);
  t.strictSame(request3.lastCall.arg.labels, ["enhancement", "size: XS"]);
  t.ok(request4.called);

  simple.restore();
  t.end();
});
