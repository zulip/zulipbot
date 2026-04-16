import nock from "nock";
import { test } from "tap";
import { assertDefined } from "ts-extras";

import client from "../../../src/client.ts";
import { activity } from "../../../src/events/index.ts";

void test("Handle multiple and missing issue references", async () => {
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

void test("Continues past inactive issue with no assignees", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];
  client.cfg.activity.check.limit = 4;
  client.cfg.activity.check.reminder = 10;
  client.cfg.activity.issues.inProgress = "in progress";
  client.cfg.activity.inactive = "inactive";
  client.cfg.auth.username = "zulipbot";

  const oldDate = new Date(Date.now() - 20 * 86400000).toISOString();
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
        repository: repository,
      },
      {
        number: 11,
        updated_at: oldDate,
        labels: [{ name: "in progress" }],
        assignees: [{ login: "alice" }],
        repository: repository,
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

void test("Unassigns and upgrades warning when prior inactive comment exists", async () => {
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

  const oldDate = new Date(Date.now() - 20 * 86400000).toISOString();

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
