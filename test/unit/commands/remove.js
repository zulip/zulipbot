"use strict";

const nock = require("nock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const remove = require("../../../src/commands/remove.js");

const payload = {
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    pull_request: true,
    number: 69,
    labels: [{ name: "bug" }, { name: "help wanted" }],
    user: {
      login: "octocat",
    },
  },
};

const template = client.templates.get("labelError");
template.content = "{labels} {labelList} {exist} {beState} {action} {type}.";
client.templates.set("labelError", template);

test("Reject if self-labelling enabled with different commenter", async (t) => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Reject if self-labelling users excludes commenter", async (t) => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"],
  };
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Reject if invalid arguments were provided", async (t) => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Remove appropriate labels", async () => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = '"bug"';

  const scope = nock("https://api.github.com")
    .put("/repos/zulip/zulipbot/issues/69/labels", { labels: ["help wanted"] })
    .reply(200);

  await remove.run.call(client, payload, commenter, args);

  scope.done();
});

test("Remove appropriate labels with single rejection message", async () => {
  const commenter = "octocat";
  const args = '"help wanted" "test"';
  const error = 'Label "test" does not exist was removed from pull request.';

  const scope = nock("https://api.github.com")
    .put("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await remove.run.call(client, payload, commenter, args);

  scope.done();
});

test("Remove appropriate labels with multiple rejection message", async () => {
  payload.issue.pull_request = false;
  const commenter = "octocat";
  const args = '"help wanted" "a" "b"';

  const error = 'Labels "a", "b" do not exist were removed from issue.';

  const scope = nock("https://api.github.com")
    .put("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await remove.run.call(client, payload, commenter, args);

  scope.done();
});
