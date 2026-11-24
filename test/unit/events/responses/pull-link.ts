import { test, type TestContext } from "node:test";
import nock from "nock";
import { partialMock } from "partial-mock";
import { bot } from "../../../../src/bot.ts";
import type { CommandPayload } from "../../../../src/commands/index.ts";
import * as pullLink from "../../../../src/events/responses/pull-link.ts";

nock.disableNetConnect();

bot.cfg.auth.username = "zulipbot";
bot.cfg.issues.commands.assign.warn = {
  labels: ["help wanted"],
  presence: false,
  exemptTeam: "server-committers",
};

function comment(
  body: string,
  login = "octokitten",
  labels = [{ name: "bug" }],
): CommandPayload {
  return partialMock({
    action: "created",
    repository: { owner: { login: "zulip" }, name: "zulip" },
    issue: { number: 40, labels, pull_request: undefined },
    comment: { body, node_id: "IC_link", user: { login } },
  });
}

const isLinkMinimization = (body: { variables?: { id?: string } }) =>
  body.variables?.id === "IC_link";

const minimized = {
  data: { minimizeComment: { minimizedComment: { isMinimized: true } } },
};

void test("pull-link: Finds #123 and pull request URLs in this repository", (t: TestContext) => {
  t.assert.deepStrictEqual(
    pullLink.findReferences(
      "See #12, https://github.com/zulip/zulip/pull/34 and #12 again.",
      "zulip",
      "zulip",
    ),
    [12, 34],
  );
  t.assert.deepStrictEqual(
    pullLink.findReferences(
      "zulip/zulip#5, a#6, https://github.com/other/zulip/pull/7, https://example.com/#8",
      "zulip",
      "zulip",
    ),
    [],
  );
});

void test("pull-link: Hides a link to the commenter's own pull request", async () => {
  for (const body of [
    "PR is ready for review: https://github.com/zulip/zulip/pull/41",
    "Opened #41 for this.",
  ]) {
    const scope = nock("https://api.github.com")
      .get("/repos/zulip/zulip/issues/41")
      .reply(200, { pull_request: {}, user: { login: "octokitten" } })
      .get("/orgs/zulip/teams/server-committers/memberships/octokitten")
      .reply(404)
      .post("/graphql", isLinkMinimization)
      .reply(200, minimized);

    await pullLink.run(bot, comment(body));

    scope.done();
  }
});

void test("pull-link: Leaves links to other people's pull requests visible", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/41")
    .reply(200, { pull_request: {}, user: { login: "octocat" } });

  await pullLink.run(bot, comment("Is #41 related?"));

  scope.done();
});

void test("pull-link: Leaves references to issues visible", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/42")
    .reply(200, { user: { login: "octokitten" } });

  await pullLink.run(bot, comment("Duplicate of #42, which I opened."));

  scope.done();
});

void test("pull-link: Leaves unrelated links and missing numbers visible", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/43")
    .reply(404);

  await pullLink.run(
    bot,
    comment("See https://zulip.com/help/ and #43 (deleted)."),
  );

  scope.done();
});

void test("pull-link: Leaves the comment visible if the lookup fails", async (t: TestContext) => {
  const log = t.mock.method(bot.octokit.log, "warn", () => undefined);
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/41")
    .reply(500);

  await pullLink.run(bot, comment("Opened #41 for this."));

  scope.done();
  t.assert.strictEqual(log.mock.callCount(), 1);
});

void test("pull-link: Committers' links are not hidden", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/41")
    .reply(200, { pull_request: {}, user: { login: "octocommitter" } })
    .get("/orgs/zulip/teams/server-committers/memberships/octocommitter")
    .reply(200, { state: "active", role: "maintainer" });

  await pullLink.run(bot, comment("Opened #41 for this.", "octocommitter"));

  scope.done();
});

void test("pull-link: Comments on issues with help wanted are left alone", async () => {
  // No request is made at all.
  await pullLink.run(
    bot,
    comment("Opened #41 for this.", "octokitten", [{ name: "help wanted" }]),
  );
});

void test("pull-link: Comments by deleted users are left alone", async () => {
  // No request is made at all.
  await pullLink.run(
    bot,
    partialMock({
      action: "created",
      repository: { owner: { login: "zulip" }, name: "zulip" },
      issue: { number: 40, labels: [{ name: "bug" }], pull_request: undefined },
      comment: { body: "Opened #41 for this.", node_id: "IC_link", user: null },
    }),
  );
});

void test("pull-link: Failure to hide is logged", async (t: TestContext) => {
  const log = t.mock.method(bot.octokit.log, "warn", () => undefined);
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/41")
    .reply(200, { pull_request: {}, user: { login: "octokitten" } })
    .get("/orgs/zulip/teams/server-committers/memberships/octokitten")
    .reply(404)
    .post("/graphql", isLinkMinimization)
    .reply(502);

  await pullLink.run(bot, comment("Opened #41 for this."));

  scope.done();
  t.assert.strictEqual(log.mock.callCount(), 1);
});
