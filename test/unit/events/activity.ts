import { test } from "node:test";
import nock from "nock";
import { assertDefined } from "ts-extras";
import client from "../../../src/client.ts";
import { activity } from "../../../src/events/index.ts";

void test("activity: Handle multiple and missing issue references", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls?per_page=100")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "Fixes #2, fixes #3, fixes #4",
        updated_at: new Date().toISOString(),
        labels: [],
      },
    ])
    .get("/repos/zulip/zulip/issues/2")
    .reply(404)
    .get("/repos/zulip/zulip/issues/3")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/issues/4")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress&per_page=100")
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
    .get("/repos/zulip/zulip/pulls?per_page=100")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress&per_page=100")
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
    .get("/repos/zulip/zulip/issues/11/comments?per_page=100")
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
    .get("/repos/zulip/zulip/pulls?per_page=100")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress&per_page=100")
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
    .get("/repos/zulip/zulip/issues/20/comments?per_page=100")
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

void test("activity: Skips issues whose PRs are under review", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.limit = 4;
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.issues.inProgress = "in progress";
  client.cfg.activity.inactive = "inactive";
  client.cfg.activity.pulls.underReview.ignore = true;
  client.cfg.activity.pulls.underReview.labels = [
    "maintainer review",
    "integration review",
  ];
  client.cfg.auth.username = "zulipbot";

  const inactiveTemplate = client.templates.get("inactiveWarning");
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

  await activity.run.call(client);

  scope.done();
});

void test("activity: Still warns if underReview.ignore is off", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.limit = 4;
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.issues.inProgress = "in progress";
  client.cfg.activity.inactive = "inactive";
  client.cfg.activity.pulls.underReview.ignore = false;
  client.cfg.activity.pulls.underReview.labels = ["maintainer review"];
  client.cfg.auth.username = "zulipbot";

  const inactiveTemplate = client.templates.get("inactiveWarning");
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

  await activity.run.call(client);

  scope.done();
});
