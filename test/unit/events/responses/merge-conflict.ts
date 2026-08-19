import { test } from "node:test";
import type { components } from "@octokit/openapi-webhooks-types";
import nock from "nock";
import { partialMock } from "partial-mock";
import { assertDefined } from "ts-extras";
import client from "../../../../src/client.ts";
import * as mergeConflict from "../../../../src/events/responses/merge-conflict.ts";

const repo: components["schemas"]["repository"] = partialMock({
  name: "zulipbot",
  owner: { login: "zulip" },
});

void test("merge-conflict: Posts warning comment on mergeable=false PR", async () => {
  client.cfg.pulls.status.mergeConflicts.branch = "main";
  client.cfg.pulls.status.mergeConflicts.comment = true;
  client.cfg.pulls.status.mergeConflicts.label = null;
  client.cfg.activity.inactive = "inactive";
  client.cfg.auth.username = "zulipbot";

  const template = client.templates.get("mergeConflictWarning");
  assertDefined(template);
  template.content = "warning {username} {branch}";
  client.templates.set("mergeConflictWarning", template);

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls")
    .reply(200, [{ number: 50 }])
    .get("/repos/zulip/zulipbot/pulls/50")
    .reply(200, { mergeable: false, user: { login: "alice" } })
    .get("/repos/zulip/zulipbot/issues/50/comments")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/50/commits")
    .reply(200, [{ commit: { committer: { date: "2026-04-01T00:00:00Z" } } }])
    .get("/repos/zulip/zulipbot/issues/50/labels")
    .reply(200, [])
    .post("/repos/zulip/zulipbot/issues/50/comments", {
      body: "warning alice main",
    })
    .reply(201);

  await mergeConflict.run.call(client, repo);

  scope.done();
});

void test("merge-conflict: Skips warning when inactive label is present", async () => {
  client.cfg.pulls.status.mergeConflicts.branch = "main";
  client.cfg.pulls.status.mergeConflicts.comment = true;
  client.cfg.pulls.status.mergeConflicts.label = null;
  client.cfg.activity.inactive = "inactive";

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls")
    .reply(200, [{ number: 51 }])
    .get("/repos/zulip/zulipbot/pulls/51")
    .reply(200, { mergeable: false, user: { login: "alice" } })
    .get("/repos/zulip/zulipbot/issues/51/comments")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/51/commits")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/issues/51/labels")
    .reply(200, [{ name: "inactive" }]);

  await mergeConflict.run.call(client, repo);

  scope.done();
});

void test("merge-conflict: Skips warning when one was already posted", async () => {
  client.cfg.pulls.status.mergeConflicts.branch = "main";
  client.cfg.pulls.status.mergeConflicts.comment = true;
  client.cfg.pulls.status.mergeConflicts.label = null;
  client.cfg.activity.inactive = "inactive";
  client.cfg.auth.username = "zulipbot";

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls")
    .reply(200, [{ number: 52 }])
    .get("/repos/zulip/zulipbot/pulls/52")
    .reply(200, { mergeable: false, user: { login: "alice" } })
    .get("/repos/zulip/zulipbot/issues/52/comments")
    .reply(200, [
      {
        id: 560,
        created_at: "2026-04-02T00:00:00Z",
        user: { login: "zulipbot" },
        body: "warning alice main\n<!-- mergeConflictWarning -->",
      },
    ])
    .get("/repos/zulip/zulipbot/pulls/52/commits")
    .reply(200, [{ commit: { committer: { date: "2026-04-01T00:00:00Z" } } }])
    .get("/repos/zulip/zulipbot/issues/52/labels")
    .reply(200, []);

  await mergeConflict.run.call(client, repo);

  scope.done();
});
