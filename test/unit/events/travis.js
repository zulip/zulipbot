"use strict";

const nock = require("nock");
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

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, []);

  const response = await travis.run.call(client, payload);

  t.notOk(response);
  scope.done();
});

test("Alert about passing build", async () => {
  const message = "[tests](https://travis-ci.org)";

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, [{ name: "travis" }])
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: message })
    .reply(200);

  await travis.run.call(client, payload);

  scope.done();
});

test("Alert about failing build", async () => {
  payload.state = "failed";

  const error = "failed [build logs](https://travis-ci.org)";

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, [{ name: "travis" }])
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await travis.run.call(client, payload);

  scope.done();
});
