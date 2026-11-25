import { test } from "node:test";
import nock from "nock";
import { partialMock } from "partial-mock";
import { assertDefined } from "ts-extras";
import { bot } from "../../../src/bot.ts";
import * as issue from "../../../src/events/issue.ts";

nock.disableNetConnect();

bot.cfg.auth.username = "zulipbot";
bot.cfg.issues.commands.assign.warn = {
  labels: ["help wanted"],
  presence: false,
  exemptTeam: "server-committers",
};

const template = bot.templates.get("claimBlock");
assertDefined(template);
template.content = "block {commenter}";

function created(body: string) {
  return partialMock<Parameters<typeof issue.run>[1]>({
    action: "created",
    repository: { owner: { login: "zulip" }, name: "zulip" },
    issue: {
      number: 40,
      assignees: [],
      labels: [{ name: "bug" }],
      pull_request: undefined,
    },
    comment: { body, node_id: "IC_claim", user: { login: "octokitten" } },
  });
}

const isMinimization = (body: { variables?: { id?: string } }) =>
  body.variables?.id === "IC_claim";

const minimized = {
  data: { minimizeComment: { minimizedComment: { isMinimized: true } } },
};

void test("issue: Extra words after claim don't change the outcome", async () => {
  // Also links to the commenter's own pull request, which the claim command
  // handles instead of the link check: issue #41 is never looked up.
  const scope = nock("https://api.github.com")
    .get("/orgs/zulip/teams/server-committers/memberships/octokitten")
    .reply(404)
    .get("/repos/zulip/zulip/issues/40/comments")
    .reply(200, [])
    .post("/repos/zulip/zulip/issues/40/comments", {
      body: "block octokitten",
    })
    .reply(200)
    .post("/graphql", isMinimization)
    .reply(200, minimized);

  await issue.run(bot, created("@zulipbot claim help wanted, see #41"));

  scope.done();
});

void test("issue: Comments without commands are checked for pull request links", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/issues/41")
    .reply(200, { pull_request: {}, user: { login: "octokitten" } })
    .get("/orgs/zulip/teams/server-committers/memberships/octokitten")
    .reply(404)
    .post("/graphql", isMinimization)
    .reply(200, minimized);

  await issue.run(bot, created("I opened #41 for this."));

  scope.done();
});
