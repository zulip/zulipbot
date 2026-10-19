import { test } from "node:test";
import nock from "nock";
import { assertDefined } from "ts-extras";
import client from "../../../src/client.ts";
import { activity } from "../../../src/events/index.ts";

void test("activity: Handle multiple and missing issue references", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];

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

  await activity.run.call(client);

  scope.done();
});

void test("activity: Continues past inactive issue with no assignees", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.limit = 4;
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.issues.inProgress = "in progress";
  client.cfg.activity.inactive = "inactive";
  client.cfg.auth.username = "zulipbot";

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

  await activity.run.call(client);

  scope.done();
});

void test("activity: Unassigns and upgrades warning when prior inactive comment exists", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.limit = 4;
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.issues.inProgress = "in progress";
  client.cfg.activity.inactive = "inactive";
  client.cfg.auth.username = "zulipbot";

  const inactiveTemplate = client.templates.get("inactiveWarning");
  assertDefined(inactiveTemplate);
  const abandonTemplate = client.templates.get("abandonWarning");
  assertDefined(abandonTemplate);
  abandonTemplate.content = "abandoned {assignee} {total} {username}";
  client.templates.set("abandonWarning", abandonTemplate);

  const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      {
        number: 20,
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
    .get("/repos/zulip/zulip/issues/20/comments")
    .reply(200, [
      {
        id: 555,
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

  await activity.run.call(client);

  scope.done();
});

void test("activity: Nudges reviewed PRs using pullRequestReminder, not reminder", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.reminder = 53;
  client.cfg.activity.check.limit = 7;
  client.cfg.activity.check.pullRequestReminder = 10;
  client.cfg.activity.inactive = "inactive";
  client.cfg.activity.pulls.reviewed.label = "reviewed";
  client.cfg.activity.issues.inProgress = "in progress";

  const updateTemplate = client.templates.get("updateWarning");
  assertDefined(updateTemplate);
  updateTemplate.content = "nudge {author} {days}";

  // Stale for 20 days: past pullRequestReminder (10) but not reminder (53).
  const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "",
        user: { login: "bob" },
        updated_at: oldDate,
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [{ name: "reviewed" }])
    .get("/repos/zulip/zulip/issues/1/comments")
    .reply(200, [])
    .post("/repos/zulip/zulip/issues/1/comments", { body: "nudge bob 10" })
    .reply(201)
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, []);

  await activity.run.call(client);

  scope.done();
});

void test("activity: Falls back to reminder for the PR nudge when pullRequestReminder is unset", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.check.limit = 7;
  client.cfg.activity.check.pullRequestReminder = null;
  client.cfg.activity.inactive = "inactive";
  client.cfg.activity.pulls.reviewed.label = "reviewed";
  client.cfg.activity.issues.inProgress = "in progress";

  // Stale for 5 days: short of reminder (10). A missing fallback would use 0
  // and nudge immediately, so no comment endpoints are mocked.
  const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "",
        user: { login: "bob" },
        updated_at: recentDate,
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [{ name: "reviewed" }])
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, []);

  await activity.run.call(client);

  scope.done();
});

void test("activity: Skips the reviewed-PR nudge when neither reminder is configured", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.reminder = null;
  client.cfg.activity.check.limit = 7;
  client.cfg.activity.check.pullRequestReminder = null;
  client.cfg.activity.inactive = "inactive";
  client.cfg.activity.pulls.reviewed.label = "reviewed";
  client.cfg.activity.issues.inProgress = "in progress";

  // Neither reminder is configured, so a long-stale reviewed pull request is
  // left alone rather than nudged at a zero-day threshold. No comment
  // endpoints are mocked, so any nudge attempt would fail the test.
  const oldDate = new Date(Date.now() - 100 * 86_400_000).toISOString();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "",
        user: { login: "bob" },
        updated_at: oldDate,
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [{ name: "reviewed" }])
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, []);

  await activity.run.call(client);

  scope.done();
});
