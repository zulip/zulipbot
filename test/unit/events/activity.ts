import { test, type TestContext } from "node:test";
import nock from "nock";
import { assertDefined } from "ts-extras";
import { bot } from "../../../src/bot.ts";
import { activity } from "../../../src/events/index.ts";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

void test("activity: Handle multiple and missing issue references", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "Fixes #2, fixes #3, fixes #4",
        updated_at: new Date().toISOString(),
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [])
    .get("/repos/zulip/zulip/issues/2")
    .reply(404)
    .get("/repos/zulip/zulip/issues/3")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/issues/4")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, []);

  await activity.run(bot);

  scope.done();
});

void test("activity: Continues past inactive issue with no assignees", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
  const repository = {
    name: "zulip",
    owner: { login: "zulip" },
    full_name: "zulip/zulip",
  };

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 10,
        updated_at: oldDate,
        labels: [{ name: "in progress" }],
        assignees: [],
        repository,
      },
      {
        number: 11,
        updated_at: oldDate,
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository,
      },
    ])
    .post("/repos/zulip/zulip/issues/10/comments", {
      body: "**ERROR:** This active issue has no assignee.",
    })
    .reply(201)
    .get("/repos/zulip/zulip/issues/11/comments")
    .reply(200, [])
    .post("/repos/zulip/zulip/issues/11/comments")
    .reply(201);

  await activity.run(bot);

  scope.done();
});

void test("activity: Unassigns and upgrades warning when prior inactive comment exists", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  const abandonTemplate = bot.templates.get("abandonWarning");
  assertDefined(abandonTemplate);
  abandonTemplate.content = "abandoned {assignee} {total} {username}";
  bot.templates.set("abandonWarning", abandonTemplate);

  const warnedDate = daysAgo(5);

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 20,
        updated_at: warnedDate,
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/20/comments")
    .reply(200, [
      {
        id: 555,
        created_at: warnedDate,
        user: { login: "zulipbot" },
        body: `prior warning\n<!-- ${inactiveTemplate.name} -->`,
      },
    ])
    .delete("/repos/zulip/zulip/issues/20/assignees", { assignees: ["alice"] })
    .reply(200)
    .patch("/repos/zulip/zulip/issues/comments/555", {
      body: "abandoned alice 14 zulipbot",
    })
    .reply(200);

  await activity.run(bot);

  scope.done();
});

void test("activity: Skips issues whose PRs are under review", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.activity.pulls.underReview.ignore = true;
  bot.cfg.activity.pulls.underReview.labels = [
    "maintainer review",
    "integration review",
  ];
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  inactiveTemplate.content = "warning {assignee} {remind} {abandon} {username}";

  const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const repository = {
    name: "zulip",
    owner: { login: "zulip" },
    full_name: "zulip/zulip",
  };
  const pull = (number: number, body: string) => ({
    base: { repo: { name: "zulip", owner: { login: "zulip" } } },
    number,
    body,
    updated_at: oldDate,
  });
  const issue = (number: number) => ({
    number,
    updated_at: oldDate,
    labels: [{ name: "in progress" }],
    assignees: [{ login: "alice" }],
    repository,
  });

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      pull(1, "Fixes #30"),
      pull(2, "Fixes #31"),
      pull(3, "Fixes #32"),
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [{ name: "maintainer review" }])
    .get("/repos/zulip/zulip/issues/30")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/repos/zulip/zulip/issues/2/labels")
    .reply(200, [{ name: "integration review" }])
    .get("/repos/zulip/zulip/issues/31")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/2/commits")
    .reply(200, [])
    .get("/repos/zulip/zulip/issues/3/labels")
    .reply(200, [{ name: "bug" }])
    .get("/repos/zulip/zulip/issues/32")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/3/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [issue(30), issue(31), issue(32)])
    .get("/repos/zulip/zulip/issues/32/comments")
    .reply(200, [])
    .post("/repos/zulip/zulip/issues/32/comments", {
      body: "warning alice 10 4 zulipbot",
    })
    .reply(201);

  await activity.run(bot);

  scope.done();
});

void test("activity: Still warns if underReview.ignore is off", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.activity.pulls.underReview.ignore = false;
  bot.cfg.activity.pulls.underReview.labels = ["maintainer review"];
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  inactiveTemplate.content = "warning {assignee} {remind} {abandon} {username}";

  const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "Fixes #40",
        updated_at: oldDate,
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [{ name: "maintainer review" }])
    .get("/repos/zulip/zulip/issues/40")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 40,
        updated_at: oldDate,
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/40/comments")
    .reply(200, [])
    .post("/repos/zulip/zulip/issues/40/comments", {
      body: "warning alice 10 4 zulipbot",
    })
    .reply(201);

  await activity.run(bot);

  scope.done();
});

void test("activity: Keep the assignee who answered the warning", async (t: TestContext) => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);

  // zulip/zulip#39628: the assignee answered the warning and was unassigned
  // anyway, `limit` days after their last reply.
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 30,
        updated_at: daysAgo(5),
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/30/comments")
    .reply(200, [
      {
        id: 556,
        created_at: daysAgo(8),
        user: { login: "zulipbot" },
        body: `prior warning\n<!-- ${inactiveTemplate.name} -->`,
      },
      {
        id: 557,
        created_at: daysAgo(5),
        user: { login: "alice" },
        body: "Yeah I am actively monitoring this issue.",
      },
    ])
    .delete("/repos/zulip/zulip/issues/30/assignees")
    .reply(200);

  await activity.run(bot);

  t.assert.deepStrictEqual(scope.pendingMocks(), [
    "DELETE https://api.github.com:443/repos/zulip/zulip/issues/30/assignees",
  ]);
  nock.cleanAll();
});

void test("activity: Warn again when the stale warning is the last comment", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  inactiveTemplate.content =
    "warned {assignee} {remind} {abandon} {username}\n<!-- inactiveWarning -->";
  bot.templates.set("inactiveWarning", inactiveTemplate);

  // Assigning someone leaves no comment behind, so a warning nobody answered
  // would otherwise stay actionable against whoever is assigned next.
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 50,
        updated_at: daysAgo(20),
        labels: [{ name: "in progress" }],
        assignees: [{ login: "bob" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/50/comments")
    .reply(200, [
      {
        id: 560,
        created_at: daysAgo(1800),
        user: { login: "zulipbot" },
        body: "prior warning\n<!-- inactiveWarning -->",
      },
    ])
    .post("/repos/zulip/zulip/issues/50/comments", {
      body: "warned bob 10 4 zulipbot\n<!-- inactiveWarning -->",
    })
    .reply(201);

  await activity.run(bot);

  scope.done();
});

void test("activity: Warn again rather than act on a stale warning", async () => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  inactiveTemplate.content =
    "warned {assignee} {remind} {abandon} {username}\n<!-- inactiveWarning -->";
  bot.templates.set("inactiveWarning", inactiveTemplate);

  // zulip/zulip#16189 still carried a warning from a contributor five years
  // earlier, which unassigned the next claimant `limit` days after they
  // claimed it, without any warning of their own.
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 40,
        updated_at: daysAgo(20),
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/40/comments")
    .reply(200, [
      {
        id: 558,
        created_at: daysAgo(1800),
        user: { login: "zulipbot" },
        body: "prior warning\n<!-- inactiveWarning -->",
      },
      {
        id: 559,
        created_at: daysAgo(20),
        user: { login: "alice" },
        body: "@zulipbot claim",
      },
    ])
    .post("/repos/zulip/zulip/issues/40/comments", {
      body: "warned alice 10 4 zulipbot\n<!-- inactiveWarning -->",
    })
    .reply(201);

  await activity.run(bot);

  scope.done();
});

void test("activity: Keep the assignee when a linked pull request was updated after the warning", async (t: TestContext) => {
  bot.cfg.activity.check.repositories = ["zulip/zulip"];
  bot.cfg.activity.check.limit = 4;
  bot.cfg.activity.check.reminder = 10;
  bot.cfg.activity.issues.inProgress = "in progress";
  bot.cfg.activity.inactive = "inactive";
  bot.cfg.auth.username = "zulipbot";

  const inactiveTemplate = bot.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);

  const warned = daysAgo(9);
  // Newer than the warning, but still older than `limit`, so the sweep gets
  // as far as deciding rather than skipping the issue as recently active.
  const pullUpdated = daysAgo(6);

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 100,
        body: "Fixes #30",
        updated_at: pullUpdated,
      },
    ])
    .get("/repos/zulip/zulip/issues/100/labels")
    .reply(200, [])
    .get("/repos/zulip/zulip/issues/30")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/100/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 30,
        updated_at: warned,
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: {
          name: "zulip",
          owner: { login: "zulip" },
          full_name: "zulip/zulip",
        },
      },
    ])
    .get("/repos/zulip/zulip/issues/30/comments")
    .reply(200, [
      {
        id: 558,
        created_at: warned,
        user: { login: "zulipbot" },
        body: `warning\n<!-- ${inactiveTemplate.name} -->`,
      },
    ])
    .delete("/repos/zulip/zulip/issues/30/assignees")
    .reply(200);

  await activity.run(bot);

  // alice said nothing on the issue; only the pull request moved.
  t.assert.deepStrictEqual(scope.pendingMocks(), [
    "DELETE https://api.github.com:443/repos/zulip/zulip/issues/30/assignees",
  ]);
});
