"use strict";

const simple = require("simple-mock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const travis = require("../../../src/events/travis.js");

const payload = {
  state: "passed",
  pull_request: false,
  pull_request_number: 69,
  build_url: "https://travis-ci.org",
  repository: {
    owner_name: "zulip",
    name: "zulipbot",
  },
};

const templates = new Map([
  ["travisPass", "[tests]({url})"],
  ["travisFail", "{state} {buildLogs}"],
]);

for (const [key, value] of templates.entries()) {
  const template = client.templates.get(key);
  template.content = value;
  client.templates.set(key, template);
}

test("Ignore if build result isn't for a pull request", async (t) => {
  const response = await travis.run.call(client, payload);

  t.notOk(response);
});

test("Ignore if no there is no Travis configuration", async (t) => {
  payload.pull_request = true;
  client.cfg.pulls.ci.travis = null;

  const response = await travis.run.call(client, payload);

  t.notOk(response);
});

test("Ignore if pull request has no configured Travis label", async (t) => {
  client.cfg.pulls.ci.travis = "travis";

  const request = simple.mock(client.issues, "listLabelsOnIssue").resolveWith({
    data: [],
  });

  const response = await travis.run.call(client, payload);

  t.ok(request.called);
  t.notOk(response);
});

test("Alert about passing build", async (t) => {
  const request = simple.mock(client.issues, "listLabelsOnIssue").resolveWith({
    data: [{ name: "travis" }],
  });

  const message = "[tests](https://travis-ci.org)";
  const request2 = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: message,
    },
  });

  await travis.run.call(client, payload);

  t.ok(request.called);
  t.ok(request2.called);
  t.equal(request2.lastCall.arg.body, message);
});

test("Alert about failing build", async (t) => {
  payload.state = "failed";
  const request = simple.mock(client.issues, "listLabelsOnIssue").resolveWith({
    data: [{ name: "travis" }],
  });

  const error = "failed [build logs](https://travis-ci.org)";
  const request2 = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error,
    },
  });

  await travis.run.call(client, payload);

  t.ok(request.called);
  t.equal(request2.lastCall.arg.body, error);
});
