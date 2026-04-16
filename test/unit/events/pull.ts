import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import { test } from "tap";

import client from "../../../src/client.ts";
import * as pull from "../../../src/events/pull.ts";

const payload: EmitterWebhookEvent<
  "pull_request" | "pull_request_review"
>["payload"] = partialMock({
  action: "opened",
  pull_request: {
    number: 69,
    title: "Fix all the bugs",
    user: { login: "octocat" },
    body: null,
    additions: 0,
    deletions: 0,
  },

  repository: {
    owner: { login: "zulip" },
    name: "zulipbot",
  },
});

void test("Ignore empty body", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, [{ name: "enhancement" }])
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

void test('Single missing reference uses "it" pronoun', async () => {
  const referencePayload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"] = partialMock({
    action: "opened",
    pull_request: {
      number: 71,
      title: "Fix bug",
      user: { login: "octocat" },
      body: "Fixes #42",
      additions: 0,
      deletions: 0,
    },

    repository: {
      owner: { login: "zulip" },
      name: "zulipbot",
    },
  });

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/71/labels")
    .reply(200, [{ name: "size: XS" }])
    .get("/repos/zulip/zulipbot/issues/42")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulipbot/pulls/71/commits")
    .reply(200, [{ commit: { message: "Unrelated commit" } }])
    .get("/repos/zulip/zulipbot/issues/71/comments")
    .reply(200, [])
    .post(
      "/repos/zulip/zulipbot/issues/71/comments",
      (body: { body: string }) =>
        body.body.includes("have not referenced it in your commit"),
    )
    .reply(201);
  await pull.run.call(client, referencePayload);

  scope.done();
});

void test('Multiple missing references use "them" pronoun', async () => {
  const referencePayload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"] = partialMock({
    action: "opened",
    pull_request: {
      number: 72,
      title: "Fix bugs",
      user: { login: "octocat" },
      body: "Fixes #42, fixes #43",
      additions: 0,
      deletions: 0,
    },

    repository: {
      owner: { login: "zulip" },
      name: "zulipbot",
    },
  });

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/72/labels")
    .reply(200, [{ name: "size: XS" }])
    .get("/repos/zulip/zulipbot/issues/42")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulipbot/issues/43")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulipbot/pulls/72/commits")
    .reply(200, [{ commit: { message: "Unrelated commit" } }])
    .get("/repos/zulip/zulipbot/issues/72/comments")
    .reply(200, [])
    .post(
      "/repos/zulip/zulipbot/issues/72/comments",
      (body: { body: string }) =>
        body.body.includes("have not referenced them in your commit"),
    )
    .reply(201);
  await pull.run.call(client, referencePayload);

  scope.done();
});

void test("Size label reflects additions + deletions from payload", async () => {
  const bigPayload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"] = partialMock({
    action: "opened",
    pull_request: {
      number: 70,
      title: "Big refactor",
      user: { login: "octocat" },
      body: null,
      // additions alone would map to "size: M" (>25); with deletions it's "size: L" (>50)
      additions: 30,
      deletions: 40,
    },

    repository: {
      owner: { login: "zulip" },
      name: "zulipbot",
    },
  });

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/70/labels")
    .reply(200, [])
    .put("/repos/zulip/zulipbot/issues/70/labels", {
      labels: ["size: L"],
    })
    .reply(200)
    .get("/repos/zulip/zulipbot/pulls/70/commits")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/issues/70/comments")
    .reply(200, []);
  await pull.run.call(client, bigPayload);

  scope.done();
});
