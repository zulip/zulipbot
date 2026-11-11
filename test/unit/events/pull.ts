import { test } from "node:test";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import { bot } from "../../../src/bot.ts";
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

void test("pull: Ignore empty body", async () => {
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
  await pull.run(bot, payload);

  scope.done();
});

void test('pull: Single missing reference uses "it" pronoun', async () => {
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
  await pull.run(bot, referencePayload);

  scope.done();
});

void test('pull: Multiple missing references use "them" pronoun', async () => {
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
  await pull.run(bot, referencePayload);

  scope.done();
});

// The "[WIP]" title stops pull.run after labeling, so these tests only
// need to mock the label and file requests.
function sizePayload(
  number: number,
  changes: number,
  {
    action = "opened",
    changedFiles = 1,
    deletions = 0,
  }: {
    action?: "opened" | "synchronize";
    changedFiles?: number;
    deletions?: number;
  } = {},
) {
  const sizeTestPayload: EmitterWebhookEvent<
    "pull_request" | "pull_request_review"
  >["payload"] = partialMock({
    action,
    pull_request: {
      number,
      title: "[WIP] Size test",
      user: { login: "octocat" },
      body: null,
      additions: changes - deletions,
      deletions,
      changed_files: changedFiles,
    },

    repository: {
      owner: { login: "zulip" },
      name: "zulipbot",
    },
  });
  return sizeTestPayload;
}

void test("pull: Size label counts additions + deletions", async () => {
  // Additions alone (30) would be "size: S"; with deletions it is "size: M".
  const sizeTestPayload = sizePayload(70, 70, { deletions: 40 });

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/70/labels")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/70/files")
    .query(true)
    .reply(200, [{ filename: "src/a.ts", changes: 70 }])
    .put("/repos/zulip/zulipbot/issues/70/labels", {
      labels: ["size: M"],
    })
    .reply(200);
  await pull.run(bot, sizeTestPayload);

  scope.done();
});

void test("pull: Size label thresholds", async (t) => {
  const cases: Array<[number, string]> = [
    [0, "size: XS"],
    [10, "size: XS"],
    [11, "size: S"],
    [50, "size: S"],
    [51, "size: M"],
    [100, "size: M"],
    [101, "size: L"],
    [200, "size: L"],
    [201, "size: XL"],
  ];

  for (const [changes, label] of cases) {
    await t.test(`${changes} changed lines is ${label}`, async () => {
      const scope = nock("https://api.github.com")
        .get("/repos/zulip/zulipbot/issues/80/labels")
        .reply(200, []);
      // The smallest size label never needs the file list.
      if (label !== "size: XS") {
        scope
          .get("/repos/zulip/zulipbot/pulls/80/files")
          .query(true)
          .reply(200, [{ filename: "src/a.ts", changes }]);
      }

      scope
        .put("/repos/zulip/zulipbot/issues/80/labels", { labels: [label] })
        .reply(200);
      await pull.run(bot, sizePayload(80, changes));

      scope.done();
    });
  }
});

void test("pull: Size label ignores excluded test paths", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/81/labels")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/81/files")
    .query(true)
    .reply(200, [
      { filename: "web/tests/compose.test.cjs", changes: 200 },
      { filename: "zerver/tests/test_users.py", changes: 100 },
    ])
    .put("/repos/zulip/zulipbot/issues/81/labels", {
      labels: ["size: XS"],
    })
    .reply(200);
  await pull.run(bot, sizePayload(81, 300, { changedFiles: 2 }));

  scope.done();
});

void test("pull: Size label counts only non-test files in mixed pull requests", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/82/labels")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/82/files")
    .query(true)
    .reply(200, [
      { filename: "web/src/compose.ts", changes: 60 },
      { filename: "web/tests/compose.test.cjs", changes: 240 },
    ])
    .put("/repos/zulip/zulipbot/issues/82/labels", {
      labels: ["size: M"],
    })
    .reply(200);
  await pull.run(bot, sizePayload(82, 300, { changedFiles: 2 }));

  scope.done();
});

void test("pull: Size label reads every page of the file list", async () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => ({
    filename: `src/file${i}.ts`,
    changes: 1,
  }));

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/83/labels")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/83/files")
    .query({ per_page: 100 })
    .reply(200, firstPage, {
      link: '<https://api.github.com/repos/zulip/zulipbot/pulls/83/files?per_page=100&page=2>; rel="next"',
    })
    .get("/repos/zulip/zulipbot/pulls/83/files")
    .query({ per_page: 100, page: 2 })
    .reply(200, [{ filename: "src/last.ts", changes: 5 }])
    .put("/repos/zulip/zulipbot/issues/83/labels", {
      labels: ["size: L"],
    })
    .reply(200);
  await pull.run(bot, sizePayload(83, 105, { changedFiles: 101 }));

  scope.done();
});

void test("pull: Size label is unchanged when the file list fails", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/84/labels")
    .reply(200, [{ name: "size: S" }])
    .get("/repos/zulip/zulipbot/pulls/84/files")
    .query(true)
    .reply(500);
  await pull.run(bot, sizePayload(84, 300));

  scope.done();
});

void test("pull: Size label is unchanged when the file list is incomplete", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/85/labels")
    .reply(200, [{ name: "size: S" }])
    .get("/repos/zulip/zulipbot/pulls/85/files")
    .query(true)
    .reply(200, [{ filename: "src/a.ts", changes: 300 }]);
  await pull.run(bot, sizePayload(85, 300, { changedFiles: 3001 }));

  scope.done();
});

void test("pull: Size label is replaced on synchronize", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/86/labels")
    .reply(200, [{ name: "enhancement" }, { name: "size: XS" }])
    .get("/repos/zulip/zulipbot/pulls/86/files")
    .query(true)
    .reply(200, [{ filename: "src/a.ts", changes: 60 }])
    .put("/repos/zulip/zulipbot/issues/86/labels", {
      labels: ["enhancement", "size: M"],
    })
    .reply(200);
  await pull.run(bot, sizePayload(86, 60, { action: "synchronize" }));

  scope.done();
});

void test("pull: Size label treats missing line counts as zero", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/87/labels")
    .reply(200, [])
    .put("/repos/zulip/zulipbot/issues/87/labels", {
      labels: ["size: XS"],
    })
    .reply(200);
  await pull.run(
    bot,
    partialMock({
      action: "opened",
      pull_request: {
        number: 87,
        title: "[WIP] Size test",
        user: { login: "octocat" },
        body: null,
        additions: undefined,
        deletions: undefined,
      },
      repository: { owner: { login: "zulip" }, name: "zulipbot" },
    }),
  );

  scope.done();
});

void test("pull: Size label uses the file list without changed_files", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/88/labels")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/88/files")
    .query(true)
    .reply(200, [{ filename: "src/a.ts", changes: 60 }])
    .put("/repos/zulip/zulipbot/issues/88/labels", {
      labels: ["size: M"],
    })
    .reply(200);
  await pull.run(
    bot,
    partialMock({
      action: "opened",
      pull_request: {
        number: 88,
        title: "[WIP] Size test",
        user: { login: "octocat" },
        body: null,
        additions: 60,
        deletions: 0,
        changed_files: undefined,
      },
      repository: { owner: { login: "zulip" }, name: "zulipbot" },
    }),
  );

  scope.done();
});

void test("pull: Size label rethrows unexpected file list errors", async (t) => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/89/labels")
    .reply(200, [{ name: "size: S" }]);
  t.mock.method(bot.octokit, "paginate", () => {
    throw new TypeError("unexpected");
  });
  await t.assert.rejects(pull.run(bot, sizePayload(89, 300)), TypeError);

  scope.done();
});
