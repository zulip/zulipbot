import nock from "nock";
import { test } from "tap";

import client from "../../../src/client.js";
import * as claim from "../../../src/commands/claim.js";

const payload = {
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
  },
};

test("Reject if commenter is already an assignee", async () => {
  const commenter = "octocat";
  const error = "**ERROR:** You have already claimed this issue.";

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Reject if assignee limit is reached", async () => {
  const commenter = "octokitten";

  const template = client.templates.get("multipleClaimWarning");
  template.content = "{commenter}";
  client.templates.set("multipleClaimWarning", template);

  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: commenter })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Throw error if collaborator check code isn't 404", async () => {
  payload.issue.assignees = [];
  const commenter = "octokitten";
  const error = "**ERROR:** Unexpected response from GitHub API.";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(500)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Rejects creation of duplicate invite", async () => {
  const commenter = "octokitten";

  const template = client.templates.get("inviteError");
  template.content = "{commenter} {repoName} {repoOwner}";
  client.templates.set("inviteError", template);

  client.invites.set("octokitten@zulip/zulipbot", 69);
  client.cfg.issues.commands.assign.newContributors.warn.labels = ["bug"];

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "octokitten zulipbot zulip",
    })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Blocks claim if labels are missing", async () => {
  const commenter = "octokitten";
  client.invites.delete("octokitten@zulip/zulipbot");
  client.cfg.auth.username = "zulipbot";
  client.cfg.issues.commands.assign.newContributors.warn.labels = ["a", "b"];

  const template = client.templates.get("claimBlock");
  template.content = "{state} {labelGrammar} {list} {username}";
  client.templates.set("claimBlock", template);

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: 'without labels "a", "b" zulipbot',
    })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Warns if labels are present without force flag", async () => {
  const commenter = "octokitten";
  client.cfg.issues.commands.assign.newContributors.warn = {
    labels: ["bug"],
    presence: true,
    force: true,
  };

  const template = client.templates.get("claimWarning");
  template.content = "warn {state} {labelGrammar} {list} {username}";
  client.templates.set("claimWarning", template);

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: 'warn with label "bug" zulipbot',
    })
    .reply(200);

  await claim.run.call(client, payload, commenter, "");

  scope.done();
});

test("Invite new contributor", async (t) => {
  const commenter = "octokitten";

  const template = client.templates.get("contributorAddition");
  template.content = "contrib {commenter} {repoName} {repoOwner}";
  client.templates.set("contributorAddition", template);

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

  await claim.run.call(client, payload, commenter, "--force");

  t.ok(client.invites.has("octokitten@zulip/zulipbot"));

  scope.done();
});

test("Throw error if permission is not specified", async () => {
  const commenter = "octocat";
  client.cfg.issues.commands.assign.newContributors.permission = null;

  const error = "**ERROR:** `newContributors.permission` wasn't configured.";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(404)
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run.call(client, payload, commenter, "--force");

  scope.done();
});

test("Always assign if commenter is contributor", async () => {
  const commenter = "octocat";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get("/repos/zulip/zulipbot/contributors")
    .reply(200, [{ login: "octocat" }])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: ["octocat"] });

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Error if no assignees were added", async () => {
  const commenter = "octocat";
  const error = "**ERROR:** Issue claiming failed (no assignee was added).";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get("/repos/zulip/zulipbot/contributors")
    .reply(200, [{ login: "octocat" }])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: [] })
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Assign if claim limit validation passed", async () => {
  const commenter = "octocat";

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get("/repos/zulip/zulipbot/contributors")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [])
    .post("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: ["octocat"] });

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Reject claim limit validation failed", async () => {
  const commenter = "octocat";

  const template = client.templates.get("claimRestriction");
  template.content = "{limit} {commenter} {issue}";
  client.templates.set("claimRestriction", template);

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get("/repos/zulip/zulipbot/contributors")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, [{ assignees: [{ login: "octocat" }] }])
    .post("/repos/zulip/zulipbot/issues/69/comments", {
      body: "1 octocat issue",
    })
    .reply(200);

  await claim.run.call(client, payload, commenter);

  scope.done();
});

test("Reject claim limit validation failed (limit over 1)", async () => {
  const commenter = "octocat";
  client.cfg.issues.commands.assign.newContributors.restricted = 2;

  const scope = nock("https://api.github.com")
    .get(`/repos/zulip/zulipbot/collaborators/${commenter}`)
    .reply(204)
    .get("/repos/zulip/zulipbot/contributors")
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

  await claim.run.call(client, payload, commenter);

  scope.done();
});
