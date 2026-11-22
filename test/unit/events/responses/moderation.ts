import { test, type TestContext } from "node:test";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { type DeepPartial, partialMock } from "partial-mock";
import { bot } from "../../../../src/bot.ts";
import * as moderation from "../../../../src/events/responses/moderation.ts";

type PullPayload = EmitterWebhookEvent<"pull_request">["payload"];
type OpenedPayload = EmitterWebhookEvent<"pull_request.opened">["payload"];

// Any request without an interceptor fails the test instead of reaching
// GitHub, so "no request" is checked by not mocking one.
nock.disableNetConnect();

const repository = {
  name: "zulipbot",
  full_name: "zulip/zulipbot",
  owner: { login: "zulip" },
};

type Overrides = Partial<{
  state: "open" | "closed";
  draft: boolean;
  title: string;
  user: { login: string };
}>;

// The test PR, as an event carries it and as GitHub returns it.
function pullRequest(overrides: Overrides = {}) {
  return {
    number: 12,
    state: "open" as const,
    draft: false,
    title: "compose: Fix the typo in the send button.",
    user: { login: "octocat" },
    ...overrides,
  };
}

function opened(overrides: Overrides = {}): OpenedPayload {
  return partialMock({
    action: "opened",
    pull_request: pullRequest(overrides),
    repository,
  });
}

// GitHub's copy of the test PR when moderation fetches it.
function latest(overrides: Overrides = {}) {
  return nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/12")
    .reply(200, pullRequest(overrides));
}

// The mock throws on reading a field it does not set, so an edit sets
// every `changes` field the code may read, even when it is undefined.
function event(
  action: string,
  extra: { changes?: Record<string, unknown>; state?: string } = {},
): PullPayload {
  const mock: unknown = {
    action,
    ...(extra.changes && { changes: extra.changes }),
    pull_request: { state: extra.state ?? "open" },
    repository,
  };
  return partialMock(mock as DeepPartial<PullPayload>);
}

// The commits by octocat, the author of every test PR.
function authorCommits(commits: object[]) {
  return nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/commits")
    .query({ author: "octocat", per_page: "1" })
    .reply(200, commits);
}

void test("moderation: Evaluates opening, reopening, pushes, and ready for review", (t: TestContext) => {
  const actions = ["opened", "reopened", "synchronize", "ready_for_review"];
  t.assert.deepStrictEqual(
    actions.map((action) => moderation.shouldEvaluate(event(action))),
    [true, true, true, true],
  );
});

void test("moderation: Leaves a PR alone when it becomes a draft", (t: TestContext) => {
  t.assert.strictEqual(
    moderation.shouldEvaluate(event("converted_to_draft")),
    false,
  );
});

void test("moderation: Ignores unrelated actions", (t: TestContext) => {
  const actions = ["labeled", "assigned", "review_requested"];
  t.assert.deepStrictEqual(
    actions.map((action) => moderation.shouldEvaluate(event(action))),
    [false, false, false],
  );
});

void test("moderation: Evaluates edits to the body, title, or base", (t: TestContext) => {
  const edit = (field: string) =>
    event("edited", {
      changes: {
        body: undefined,
        title: undefined,
        base: undefined,
        [field]: { from: "old" },
      },
    });
  t.assert.deepStrictEqual(
    ["body", "title", "base"].map((field) =>
      moderation.shouldEvaluate(edit(field)),
    ),
    [true, true, true],
  );
});

void test("moderation: Ignores edits that change nothing it checks", (t: TestContext) => {
  const changes = { body: undefined, title: undefined, base: undefined };
  t.assert.strictEqual(
    moderation.shouldEvaluate(event("edited", { changes })),
    false,
  );
});

void test("moderation: Ignores closed PRs", (t: TestContext) => {
  t.assert.strictEqual(
    moderation.shouldEvaluate(event("edited", { state: "closed" })),
    false,
  );
});

void test("moderation: Drafts are not eligible", async (t: TestContext) => {
  const payload = opened({ draft: true });
  t.assert.strictEqual(
    await moderation.isEligible(bot, payload.pull_request, payload.repository),
    false,
  );
});

void test("moderation: WIP PRs are not eligible", async (t: TestContext) => {
  const payload = opened({ title: "wip: compose: Fix the typo." });
  t.assert.strictEqual(
    await moderation.isEligible(bot, payload.pull_request, payload.repository),
    false,
  );
});

void test("moderation: PRs by existing contributors are not eligible", async (t: TestContext) => {
  const scope = authorCommits([{ sha: "abc" }]);
  const payload = opened();
  t.assert.strictEqual(
    await moderation.isEligible(bot, payload.pull_request, payload.repository),
    false,
  );
  scope.done();
});

void test("moderation: PRs by new contributors are eligible", async (t: TestContext) => {
  const scope = authorCommits([]);
  const payload = opened();
  t.assert.strictEqual(
    await moderation.isEligible(bot, payload.pull_request, payload.repository),
    true,
  );
  scope.done();
});

void test("moderation: A failed contributor lookup does not make the author new", async (t: TestContext) => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/commits")
    .query({ author: "octocat", per_page: "1" })
    .reply(500);
  const payload = opened();
  await t.assert.rejects(
    moderation.isEligible(bot, payload.pull_request, payload.repository),
    { status: 500 },
  );
  scope.done();
});

void test("moderation: Context fetches every page of files once", async (t: TestContext) => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/12/files")
    .query({ per_page: "100" })
    .reply(200, [{ filename: "a" }], {
      Link: `<https://api.github.com/repos/zulip/zulipbot/pulls/12/files?per_page=100&page=2>; rel="next"`,
    })
    .get("/repos/zulip/zulipbot/pulls/12/files")
    .query({ per_page: "100", page: "2" })
    .reply(200, [{ filename: "b" }]);
  const payload = opened();
  const context = new moderation.Context(
    bot,
    payload.pull_request,
    payload.repository,
  );

  const first = await context.files();
  const second = await context.files();
  t.assert.deepStrictEqual(
    first.map((file) => file.filename),
    ["a", "b"],
  );
  t.assert.strictEqual(second, first);
  scope.done();
});

void test("moderation: Context accepts a file list shorter than the PR's count", async (t: TestContext) => {
  // A push between fetching the PR and listing its files can drop files.
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/12/files")
    .query({ per_page: "100" })
    .reply(200, [{ filename: "a" }]);
  const context = new moderation.Context(
    bot,
    partialMock({ number: 12, changed_files: 2 }),
    opened().repository,
  );

  const files = await context.files();
  t.assert.deepStrictEqual(
    files.map((file) => file.filename),
    ["a"],
  );
  scope.done();
});

void test("moderation: Context rejects a file list at GitHub's limit", async (t: TestContext) => {
  const files = Array.from({ length: 100 }, (_, i) => ({
    filename: `f${i}`,
  }));
  let scope = nock("https://api.github.com");
  for (let page = 1; page <= 30; page += 1) {
    const next =
      page < 30
        ? {
            Link: `<https://api.github.com/repos/zulip/zulipbot/pulls/12/files?per_page=100&page=${page + 1}>; rel="next"`,
          }
        : {};
    scope = scope
      .get("/repos/zulip/zulipbot/pulls/12/files")
      .query(
        page === 1 ? { per_page: "100" } : { per_page: "100", page: `${page}` },
      )
      .reply(200, files, next);
  }

  const payload = opened();
  const context = new moderation.Context(
    bot,
    payload.pull_request,
    payload.repository,
  );

  await t.assert.rejects(
    context.files(),
    /Listed 3000 files .*, GitHub's limit/v,
  );
  scope.done();
});

void test("moderation: Does nothing when disabled", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = false;
  t.assert.strictEqual(await moderation.run(bot, opened()), undefined);
});

void test("moderation: Does not evaluate ineligible PRs", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest();
  const scope = authorCommits([{ sha: "abc" }]);
  t.assert.strictEqual(await moderation.run(bot, opened()), undefined);
  fetched.done();
  scope.done();
});

void test("moderation: Judges the latest version of the PR", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest({ draft: true });
  t.assert.strictEqual(await moderation.run(bot, opened()), undefined);
  fetched.done();
});

void test("moderation: Skips a PR that closed after the event", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest({ state: "closed" });
  t.assert.strictEqual(await moderation.run(bot, opened()), undefined);
  fetched.done();
});

void test("moderation: Runs every check in order on one shared context", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest();
  const scope = authorCommits([])
    .get("/repos/zulip/zulipbot/pulls/12/files")
    .query({ per_page: "100" })
    .reply(200, [{ filename: "a" }]);

  const contexts: moderation.Context[] = [];
  const check =
    (name: string): moderation.Check =>
    async (_bot, context) => {
      contexts.push(context);
      const files = await context.files();
      return [{ check: name, message: `${files.length} file` }];
    };

  moderation.checks.push(check("first"), check("second"));
  try {
    t.assert.deepStrictEqual(await moderation.run(bot, opened()), [
      { check: "first", message: "1 file" },
      { check: "second", message: "1 file" },
    ]);
  } finally {
    moderation.checks.length = 0;
  }

  t.assert.strictEqual(contexts[0], contexts[1]);
  fetched.done();
  scope.done();
});
