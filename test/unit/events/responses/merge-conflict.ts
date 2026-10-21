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
    .get("/repos/zulip/zulipbot/pulls?per_page=100")
    .reply(200, [{ number: 50 }])
    .get("/repos/zulip/zulipbot/pulls/50")
    .reply(200, { mergeable: false, user: { login: "alice" }, labels: [] })
    .get("/repos/zulip/zulipbot/issues/50/comments?per_page=100")
    .reply(200, [])
    .get("/repos/zulip/zulipbot/pulls/50/commits?per_page=100")
    .reply(200, [{ commit: { committer: { date: "2026-04-01T00:00:00Z" } } }])
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
    .get("/repos/zulip/zulipbot/pulls?per_page=100")
    .reply(200, [{ number: 51 }])
    .get("/repos/zulip/zulipbot/pulls/51")
    .reply(200, {
      mergeable: false,
      user: { login: "alice" },
      labels: [{ name: "inactive" }],
    });

  await mergeConflict.run.call(client, repo);

  scope.done();
});
