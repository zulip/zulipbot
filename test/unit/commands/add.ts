import nock from "nock";
import { partialMock } from "partial-mock";
import { test } from "tap";
import { assertDefined } from "ts-extras";

import client from "../../../src/client.ts";
import * as add from "../../../src/commands/add.ts";
import type { CommandPayload } from "../../../src/commands/index.ts";

const payload: CommandPayload = partialMock({
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    pull_request: undefined,
    number: 69,
    labels: [{ name: "test" }, { name: "test2" }],
    user: {
      login: "octocat",
    },
  },
});

const repoLabels = [{ name: "test" }, { name: "test2" }, { name: "bug" }];

const template = client.templates.get("labelError");
assertDefined(template);
template.content = "{labels} {labelList} {exist} {beState} {action} {type}.";
client.templates.set("labelError", template);

void test("Reject if self-labelling enabled with different commenter", async (t) => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

void test("Reject if self-labelling users excludes commenter", async (t) => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"],
  };
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

void test("Reject if invalid arguments were provided", async (t) => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

void test("Add appropriate labels", async () => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = '"bug"';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200);

  await add.run.call(client, payload, commenter, args);

  scope.done();
});

const payload2: CommandPayload = partialMock({
  repository: payload.repository,
  issue: {
    pull_request: {},
    number: payload.issue.number,
    labels: payload.issue.labels,
    user: { login: "octocat" },
  },
});

void test("Add appropriate label and reject label not in repository", async () => {
  const commenter = "octocat";
  const args = '"bug" "invalid"';
  const error = 'Label "invalid" does not exist was added to pull request.';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await add.run.call(client, payload2, commenter, args);

  scope.done();
});

void test("Add appropriate labels and reject labels not in repository", async () => {
  const commenter = "octocat";
  const args = '"bug" "a" "b"';
  const error = 'Labels "a", "b" do not exist were added to issue.';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await add.run.call(client, payload, commenter, args);

  scope.done();
});

void test("Add appropriate labels and reject already added label", async () => {
  const commenter = "octocat";
  const args = '"bug" "test"';
  const error = 'Label "test" already exists was added to pull request.';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/labels", { labels: ["bug"] })
    .reply(200)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await add.run.call(client, payload2, commenter, args);

  scope.done();
});

void test("Add appropriate labels and reject already added labels", async () => {
  const commenter = "octocat";
  const args = '"test" "test2"';
  const error = 'Labels "test", "test2" already exist were added to issue.';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await add.run.call(client, payload, commenter, args);

  scope.done();
});
