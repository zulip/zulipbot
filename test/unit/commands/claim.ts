import { test, type TestContext } from "node:test";
import nock from "nock";
import { partialMock } from "partial-mock";
import { assertDefined } from "ts-extras";
import { bot } from "../../../src/bot.ts";
import * as claim from "../../../src/commands/claim.ts";
import type { CommandPayload } from "../../../src/commands/index.ts";

nock.disableNetConnect();

const payload: CommandPayload = partialMock({
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    number: 69,
    assignees: [{ login: "octocat" }],
    labels: [{ name: "bug" }],
    pull_request: undefined,
  },
});

void test("claim: Reject if commenter is already an assignee", async () => {
  const commenter = "octocat";
  const error = "**ERROR:** You have already claimed this issue.";

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run(bot, payload, commenter, "");

  scope.done();
});

void test("claim: Reject if assignee limit is reached", async () => {
  const commenter = "octokitten";
  const helpWantedPayload: CommandPayload = partialMock({
    repository: payload.repository,
    issue: {
      number: 69,
      assignees: [{ login: "octocat" }],
      labels: [{ name: "bug" }, { name: "help wanted" }],
      pull_request: undefined,
    },
  });

  const template = bot.templates.get("multipleClaimWarning");
  assertDefined(template);
  template.content = "{commenter}";
  bot.templates.set("multipleClaimWarning", template);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: commenter })
    .reply(200);

  await claim.run(bot, helpWantedPayload, commenter, "");

  scope.done();
});

void test("claim: Check labels before the assignee limit", async () => {
  const commenter = "octokitten";
  bot.cfg.auth.username = "zulipbot";

  const template = bot.templates.get("claimBlock");
  assertDefined(template);
  template.content = "block {commenter}";
  bot.templates.set("claimBlock", template);

  // The issue is assigned and lacks "help wanted", so this is the
  // once-per-issue block warning rather than multipleClaimWarning.
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, [])
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "block octokitten",
    })
    .reply(200);

  await claim.run(bot, payload, commenter, "");

  scope.done();
});

const payload2: CommandPayload = partialMock({
  repository: payload.repository,
  issue: {
    number: payload.issue.number,
    assignees: [],
    labels: payload.issue.labels,
    pull_request: payload.issue.pull_request,
  },
});

void test("claim: Throw error if collaborator check code isn't 404", async () => {
  const commenter = "octokitten";
  const error = "**ERROR:** Unexpected response from GitHub API.";
  bot.cfg.issues.commands.assign.warn.labels = ["bug"];

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(500)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Rejects creation of duplicate invite", async () => {
  const commenter = "octokitten";

  const template = bot.templates.get("inviteError");
  assertDefined(template);
  template.content = "{commenter} {repoName} {repoOwner}";
  bot.templates.set("inviteError", template);

  bot.invites.set("octokitten@zulip/zulipbot", 69);
  bot.cfg.issues.commands.assign.warn.labels = ["bug"];

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "octokitten zulipbot zulip",
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Reject claim on pull request", async () => {
  const commenter = "octocat";

  const payload3: CommandPayload = partialMock({
    repository: {
      owner: { login: "zulip" },
      name: "zulipbot",
    },
    issue: {
      number: 123,
      assignees: [],
      pull_request: {
        url: "https://api.github.com/repos/zulip/zulipbot/pulls/123",
      },
    },
  });

  const template = bot.templates.get("claimPullRequest");
  assertDefined(template);
  template.content = "{commenter} {repoName} {repoOwner}";
  bot.templates.set("claimPullRequest", template);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/123/comments", {
      body: "octocat zulipbot zulip",
    })
    .reply(200);

  await claim.run(bot, payload3, commenter, "");

  scope.done();
});

void test("claim: Blocks claim if labels are missing", async () => {
  const commenter = "octokitten";
  bot.invites.delete("octokitten@zulip/zulipbot");
  bot.cfg.auth.username = "zulipbot";
  bot.cfg.issues.commands.assign.warn.labels = ["a", "b"];

  const template = bot.templates.get("claimBlock");
  assertDefined(template);
  template.content = "{state} {labelGrammar} {list} {username}";
  bot.templates.set("claimBlock", template);

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, [
      { user: { login: "octocat" }, body: "Can I work on this?" },
      // Only the bot's own warnings count.
      { user: { login: "octocat" }, body: "<!-- claimBlock -->" },
    ])
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: 'without labels "a", "b" zulipbot',
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Doesn't repeat the block warning on an issue", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, [
      {
        user: { login: "zulipbot" },
        body: "@octocat ...\n\n<!-- claimBlock -->\n",
      },
    ]);

  await claim.run(bot, payload2, "octokitten", "");

  scope.done();
});

void test("claim: Recognizes block warnings posted before the marker", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, [
      {
        user: { login: "zulipbot" },
        body: '@octocat You have attempted to claim an issue without the label "help wanted". To learn how to pick up issues, ...',
      },
    ]);

  await claim.run(bot, payload2, "octokitten", "");

  scope.done();
});

void test("claim: Warns if labels are present without force flag", async () => {
  const commenter = "octokitten";
  bot.cfg.issues.commands.assign.warn = {
    labels: ["bug"],
    presence: true,
    force: true,
  };

  const template = bot.templates.get("claimWarning");
  assertDefined(template);
  template.content = "warn {state} {labelGrammar} {list} {username}";
  bot.templates.set("claimWarning", template);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: 'warn with label "bug" zulipbot',
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Invite new contributor", async (t: TestContext) => {
  const commenter = "octokitten";

  const template = bot.templates.get("contributorAddition");
  assertDefined(template);
  template.content = "contrib {commenter} {repoName} {repoOwner}";
  bot.templates.set("contributorAddition", template);

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "contrib octokitten zulipbot zulip",
    })
    .reply(200)
    .put(`/repos/zulip/zulipbot/collaborators/${commenter}`, {
      permission: "pull",
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "--force");

  t.assert.ok(bot.invites.has("octokitten@zulip/zulipbot"));

  scope.done();
});

void test("claim: Throw error if permission is not specified", async () => {
  const commenter = "octocat";
  bot.cfg.issues.commands.assign.newContributors.permission = null;

  const error = "**ERROR:** `newContributors.permission` wasn't configured.";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run(bot, payload2, commenter, "--force");

  scope.done();
});

void test("claim: Always assign if commenter has at least one commit", async () => {
  const commenter = "octocat";
  bot.cfg.issues.commands.assign.warn.presence = false;

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get(`/repos/zulip/zulipbot/commits`)
    .query({ author: commenter, per_page: 1 })
    .reply(200, [{ sha: "dummysha123" }])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: ["octocat"] });

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Error if no assignees were added", async () => {
  const commenter = "octocat";
  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get(`/repos/zulip/zulipbot/commits`)
    .query({ author: commenter, per_page: 1 })
    .reply(200, [{ sha: "dummysha123" }])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: [] })
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Assign if claim limit validation passed", async () => {
  const commenter = "octocat";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get(`/repos/zulip/zulipbot/commits`)
    .query({ author: commenter, per_page: 1 })
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: ["octocat"] });

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Reject claim limit validation failed", async () => {
  const commenter = "octocat";

  const template = bot.templates.get("claimRestriction");
  assertDefined(template);
  template.content = "{limit} {commenter} {issue}";
  bot.templates.set("claimRestriction", template);

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get(`/repos/zulip/zulipbot/commits`)
    .query({ author: commenter, per_page: 1 })
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [{ assignees: [{ login: "octocat" }] }])
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "1 octocat issue",
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});

void test("claim: Reject claim limit validation failed (limit over 1)", async () => {
  const commenter = "octocat";
  bot.cfg.issues.commands.assign.newContributors.restricted = 2;

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get(`/repos/zulip/zulipbot/commits`)
    .query({ author: commenter, per_page: 1 })
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [
      { assignees: [{ login: "octocat" }] },
      { assignees: [{ login: "octocat" }] },
    ])
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "2 octocat issues",
    })
    .reply(200);

  await claim.run(bot, payload2, commenter, "");

  scope.done();
});
