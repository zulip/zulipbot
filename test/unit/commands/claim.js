"use strict";

const simple = require("simple-mock");
const test = require("tap").test;

const client = require("../../../src/client.js");
const claim = require("../../../src/commands/claim.js");

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

test("Reject if commenter is already an assignee", async (t) => {
  const commenter = "octocat";

  const error = "**ERROR:** You have already claimed this issue.";
  const request = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request.called);
  t.equal(request.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

test("Reject if assignee limit is reached", async (t) => {
  const commenter = "octokitten";

  const template = client.templates.get("multipleClaimWarning");
  template.content = "{commenter}";
  client.templates.set("multipleClaimWarning", template);

  const request = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request.called);
  t.equal(request.lastCall.arg.body, commenter);

  simple.restore();
  t.end();
});

test("Throw error if collaborator check code isn't 404", async (t) => {
  payload.issue.assignees = [];
  const commenter = "octokitten";

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 500,
  });

  const error = "**ERROR:** Unexpected response from GitHub API.";
  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

test("Rejects creation of duplicate invite", async (t) => {
  const commenter = "octokitten";

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 404,
  });

  const template = client.templates.get("inviteError");
  template.content = "{commenter} {repoName} {repoOwner}";
  client.templates.set("inviteError", template);

  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  client.invites.set("octokitten@zulip/zulipbot", 69);

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, "octokitten zulipbot zulip");

  simple.restore();
  t.end();
});

test("Blocks claim if labels are missing", async (t) => {
  const commenter = "octokitten";
  client.invites.delete("octokitten@zulip/zulipbot");
  client.cfg.auth.username = "zulipbot";
  client.cfg.issues.commands.assign.newContributors.warn.labels = ["a", "b"];

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 404,
  });

  const template = client.templates.get("claimBlock");
  template.content = "{state} {labelGrammar} {list} {username}";
  client.templates.set("claimBlock", template);

  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);
  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, 'without labels "a", "b" zulipbot');

  simple.restore();
  t.end();
});

test("Warns if labels are present without force flag", async (t) => {
  const commenter = "octokitten";
  client.cfg.issues.commands.assign.newContributors.warn = {
    labels: ["bug"],
    presence: true,
    force: true,
  };

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 404,
  });

  const template = client.templates.get("claimWarning");
  template.content = "warn {state} {labelGrammar} {list} {username}";
  client.templates.set("claimWarning", template);

  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter, "");

  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, 'warn with label "bug" zulipbot');

  simple.restore();
  t.end();
});

test("Invite new contributor", async (t) => {
  const commenter = "octokitten";

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 404,
  });

  const template = client.templates.get("contributorAddition");
  template.content = "contrib {commenter} {repoName} {repoOwner}";
  client.templates.set("contributorAddition", template);

  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  const request3 = simple.mock(client.repos, "addCollaborator").resolveWith();

  await claim.run.call(client, payload, commenter, "--force");

  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, "contrib octokitten zulipbot zulip");
  t.equal(request3.lastCall.arg.permission, "pull");
  t.ok(client.invites.has("octokitten@zulip/zulipbot"));

  simple.restore();
  t.end();
});

test("Throw error if permission is not specified", async (t) => {
  const commenter = "octocat";
  client.cfg.issues.commands.assign.newContributors.permission = null;

  const request1 = simple.mock(client.repos, "checkCollaborator").rejectWith({
    status: 404,
  });

  const error = "**ERROR:** `newContributors.permission` wasn't configured.";
  const request2 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter, "--force");

  t.ok(request1.called);
  t.equal(request2.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

test("Always assign if commenter is contributor", async (t) => {
  const commenter = "octocat";

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple
    .mock(client.util, "getAllPages")
    .resolveWith([{ login: "octocat" }]);

  const request3 = simple.mock(client.issues, "addAssignees").resolveWith({
    data: {
      assignees: ["octocat"],
    },
  });

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.ok(request2.called);
  t.strictSame(request3.lastCall.arg.assignees, [commenter]);

  simple.restore();
  t.end();
});

test("Always assign if commenter is contributor", async (t) => {
  const commenter = "octocat";

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple
    .mock(client.util, "getAllPages")
    .resolveWith([{ login: "octocat" }]);

  const request3 = simple.mock(client.issues, "addAssignees").resolveWith({
    data: {
      assignees: ["octocat"],
    },
  });

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.ok(request2.called);
  t.strictSame(request3.lastCall.arg.assignees, [commenter]);

  simple.restore();
  t.end();
});

test("Error if no assignees were added", async (t) => {
  const commenter = "octocat";

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple
    .mock(client.util, "getAllPages")
    .resolveWith([{ login: "octocat" }]);

  const request3 = simple.mock(client.issues, "addAssignees").resolveWith({
    data: {
      assignees: [],
    },
  });

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  const request4 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.ok(request2.called);
  t.ok(request3.called);
  t.equal(request4.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

test("Assign if claim limit validation passed", async (t) => {
  const commenter = "octocat";

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple.mock(client.util, "getAllPages").resolveWith([]);

  const request3 = simple.mock(client.issues, "addAssignees").resolveWith({
    data: {
      assignees: ["octocat"],
    },
  });

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.equal(request2.callCount, 2);
  t.strictSame(request3.lastCall.arg.assignees, [commenter]);

  simple.restore();
  t.end();
});

test("Reject claim limit validation failed", async (t) => {
  const commenter = "octocat";

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple
    .mock(client.util, "getAllPages")
    .resolveWith([])
    .resolveWith([
      {
        assignees: [
          {
            login: "octocat",
          },
        ],
      },
    ]);

  const template = client.templates.get("claimRestriction");
  template.content = "{limit} {commenter} {issue}";
  client.templates.set("claimRestriction", template);

  const request3 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.equal(request2.callCount, 2);
  t.equal(request3.lastCall.arg.body, "1 octocat issue");

  simple.restore();
  t.end();
});

test("Reject claim limit validation failed (limit over 1)", async (t) => {
  const commenter = "octocat";
  client.cfg.issues.commands.assign.newContributors.restricted = 2;

  const request1 = simple.mock(client.repos, "checkCollaborator").resolveWith();

  const request2 = simple
    .mock(client.util, "getAllPages")
    .resolveWith([])
    .resolveWith([
      {
        assignees: [
          {
            login: "octocat",
          },
        ],
      },
      {
        assignees: [
          {
            login: "octocat",
          },
        ],
      },
    ]);

  const request3 = simple.mock(client.issues, "createComment").resolveWith();

  await claim.run.call(client, payload, commenter);

  t.ok(request1.called);
  t.equal(request2.callCount, 2);
  t.equal(request3.lastCall.arg.body, "2 octocat issues");

  simple.restore();
  t.end();
});
