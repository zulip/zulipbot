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

// Runs `callback` with only the given checks registered.
async function withChecks(
  checks: readonly moderation.Check[],
  callback: () => Promise<void>,
) {
  const saved = moderation.checks.splice(0, Infinity, ...checks);
  try {
    await callback();
  } finally {
    moderation.checks.splice(0, Infinity, ...saved);
  }
}

// A check that reports one finding per message, or none without any.
const fakeCheck =
  (...messages: string[]): moderation.Check =>
  async () =>
    messages.map((message) => ({ check: "test", message }));

const comments = "/repos/zulip/zulipbot/issues/12/comments";
const report = (findings: string) =>
  `@octocat, thanks for your pull request! Please address the following so it is ready for review:

${findings}

This comment is updated as you push changes or edit the pull request description.

<!-- moderationReport -->
`;
const passing = `@octocat, thanks for addressing the feedback in this comment! Everything it checks for is in place now.

<!-- moderationReport -->
`;
const posted = (body: string) => [{ id: 7, user: { login: "zulipbot" }, body }];

void test("moderation: Does nothing when disabled", async () => {
  bot.cfg.pulls.moderation.enabled = false;
  await moderation.run(bot, opened());
});

void test("moderation: Does not evaluate ineligible PRs", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest();
  const scope = authorCommits([{ sha: "abc" }]);
  await withChecks([fakeCheck("Unreachable.")], async () =>
    moderation.run(bot, opened()),
  );
  fetched.done();
  scope.done();
});

void test("moderation: Judges the latest version of the PR", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest({ draft: true });
  await withChecks([fakeCheck("Unreachable.")], async () =>
    moderation.run(bot, opened()),
  );
  fetched.done();
});

void test("moderation: Skips a PR that closed after the event", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  const fetched = latest({ state: "closed" });
  await withChecks([fakeCheck("Unreachable.")], async () =>
    moderation.run(bot, opened()),
  );
  fetched.done();
});

void test("moderation: Posts one comment with every finding in check order", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const fetched = latest();
  const contexts: moderation.Context[] = [];
  const recording =
    (message: string): moderation.Check =>
    async (_bot, context) => {
      contexts.push(context);
      return [{ check: "test", message }];
    };

  const scope = authorCommits([])
    .get(comments)
    .reply(200, [])
    .post(comments, {
      body: report("- First.\n- Second,\n  on two lines."),
    })
    .reply(201);
  await withChecks(
    [recording("First."), recording("Second,\non two lines.")],
    async () => moderation.run(bot, opened()),
  );

  t.assert.strictEqual(contexts[0], contexts[1]);
  fetched.done();
  scope.done();
});

void test("moderation: Edits the comment when the findings change", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const fetched = latest();
  const scope = authorCommits([])
    .get(comments)
    .reply(200, posted(report("- Old.")))
    .patch("/repos/zulip/zulipbot/issues/comments/7", {
      body: report("- New."),
    })
    .reply(200);
  await withChecks([fakeCheck("New.")], async () =>
    moderation.run(bot, opened()),
  );
  fetched.done();
  scope.done();
});

void test("moderation: Leaves the comment alone when nothing changed", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const fetched = latest();
  const scope = authorCommits([])
    .get(comments)
    .reply(200, posted(report("- Same.")));
  await withChecks([fakeCheck("Same.")], async () =>
    moderation.run(bot, opened()),
  );
  fetched.done();
  scope.done();
});

void test("moderation: Edits the comment to passing once everything is fixed", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const fetched = latest();
  const scope = authorCommits([])
    .get(comments)
    .reply(200, posted(report("- Fixed now.")))
    .patch("/repos/zulip/zulipbot/issues/comments/7", { body: passing })
    .reply(200);
  await withChecks([fakeCheck()], async () => moderation.run(bot, opened()));
  fetched.done();
  scope.done();
});

void test("moderation: Posts nothing for a PR that never had findings", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const fetched = latest();
  const scope = authorCommits([]).get(comments).reply(200, []);
  await withChecks([fakeCheck()], async () => moderation.run(bot, opened()));
  fetched.done();
  scope.done();
});

void test("moderation: Events arriving together post one comment", async () => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  // The comments list reflects what was posted so far, so two events
  // that both read it before either posts would both post.
  const bodies: string[] = [];
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/12")
    .times(2)
    .reply(200, pullRequest())
    .get("/repos/zulip/zulipbot/commits")
    .query({ author: "octocat", per_page: "1" })
    .times(2)
    .reply(200, [])
    .get(comments)
    .times(2)
    .reply(200, () => bodies.flatMap((body) => posted(body)))
    .post(comments)
    .reply(201, async (request: Request) => {
      const { body } = (await request.json()) as { body: string };
      bodies.push(body);
      return {};
    });
  await withChecks([fakeCheck("Once.")], async () => {
    await Promise.all([
      moderation.run(bot, opened()),
      moderation.run(bot, opened()),
    ]);
  });
  scope.done();
});

async function withDryRun(callback: () => Promise<void>) {
  const wasDryRun = bot.cfg.pulls.moderation.dryRun;
  bot.cfg.pulls.moderation.dryRun = true;
  try {
    await callback();
  } finally {
    bot.cfg.pulls.moderation.dryRun = wasDryRun;
  }
}

void test("moderation: Dry-run logs proposed comment creation without writing", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => {
    lines.push(line);
  });

  const fetched = latest();
  const scope = authorCommits([]).get(comments).reply(200, []);

  await withDryRun(async () =>
    withChecks([fakeCheck("First.", "Second.")], async () =>
      moderation.run(bot, opened()),
    ),
  );

  fetched.done();
  scope.done();
  t.assert.strictEqual(lines.length, 1);
  const record = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  t.assert.strictEqual(record["type"], "moderation_dry_run");
  t.assert.strictEqual(record["repository"], "zulip/zulipbot");
  t.assert.deepStrictEqual(record["target"], {
    kind: "pull_request",
    number: 12,
  });
  t.assert.deepStrictEqual(record["findings"], [
    { check: "test", message: "First." },
    { check: "test", message: "Second." },
  ]);
  t.assert.deepStrictEqual(record["comment"], {
    action: "create",
    body: report("- First.\n- Second."),
  });
});

void test("moderation: Dry-run logs proposed comment edits without writing", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => {
    lines.push(line);
  });

  const fetched = latest();
  const scope = authorCommits([])
    .get(comments)
    .reply(200, posted(report("- Old.")));

  await withDryRun(async () =>
    withChecks([fakeCheck()], async () => moderation.run(bot, opened())),
  );

  fetched.done();
  scope.done();
  t.assert.strictEqual(lines.length, 1);
  const record = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
  t.assert.deepStrictEqual(record["findings"], []);
  t.assert.deepStrictEqual(record["comment"], {
    action: "update",
    commentId: 7,
    body: passing,
  });
});

void test("moderation: Dry-run logs nothing when no comment change is needed", async (t: TestContext) => {
  bot.cfg.pulls.moderation.enabled = true;
  bot.cfg.auth.username = "zulipbot";
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => {
    lines.push(line);
  });

  const fetched = latest();
  const scope = authorCommits([]).get(comments).reply(200, []);

  await withDryRun(async () =>
    withChecks([fakeCheck()], async () => moderation.run(bot, opened())),
  );

  fetched.done();
  scope.done();
  t.assert.deepStrictEqual(lines, []);
});
