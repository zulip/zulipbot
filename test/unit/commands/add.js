import nock from "nock";
import { test } from "tap";

import client from "../../../src/client.js";
import * as add from "../../../src/commands/add.js";

const payload = {
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    pull_request: false,
    number: 69,
    labels: [{ name: "test" }, { name: "test2" }],
    user: {
      login: "octocat",
    },
  },
};

const repoLabels = [
  { name: "test" },
  { name: "test2" },
  { name: "bug" },
  { name: "area: test (specific)" },
  { name: "area: test" },
];

const template = client.templates.get("labelError");
template.content = "{labels} {labelList} {exist} {beState} {action} {type}.";
client.templates.set("labelError", template);

test("Reject if self-labelling enabled with different commenter", async (t) => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Reject if self-labelling users excludes commenter", async (t) => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"],
  };
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Reject if invalid arguments were provided", async (t) => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await add.run.call(client, payload, commenter, args);

  t.notOk(response);
});

test("Add appropriate labels", async () => {
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

test("Add appropriate label and reject label not in repository", async () => {
  payload.issue.pull_request = true;
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

  await add.run.call(client, payload, commenter, args);

  scope.done();
});

test("Add appropriate labels and reject labels not in repository", async () => {
  payload.issue.pull_request = false;
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

test("Add appropriate labels and reject already added label", async () => {
  payload.issue.pull_request = true;
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

  await add.run.call(client, payload, commenter, args);

  scope.done();
});

test("Add appropriate labels and reject already added labels", async () => {
  payload.issue.pull_request = false;
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

test("Add general label when specific label is added", async () => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = '"area: test (specific)"';

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/labels")
    .reply(200, repoLabels)
    .post("/repos/zulip/zulipbot/issues/69/labels", {
      labels: ["area: test (specific)", "area: test"],
    })
    .reply(200);

  await add.run.call(client, payload, commenter, args);

  scope.done();
});
