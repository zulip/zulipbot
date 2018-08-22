const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const member = require(`${homePath}/events/member.js`);

const payload = {
  action: "removed",
  repository: {
    full_name: "zulip/zulipbot"
  },
  member: {
    login: "octokitten"
  }
};

test("Ignore if payload action isn't added", async t => {
  const response = await member.run.call(client, payload);

  t.strictSame(response, false);

  t.end();
});

test("Ignore if there aren't any claim command aliases", async t => {
  payload.action = "added";
  client.cfg.issues.commands.assign.claim = [];
  const response = await member.run.call(client, payload);

  t.strictSame(response, false);

  t.end();
});

test("Ignore if there aren't any recorded invites", async t => {
  client.cfg.issues.commands.assign.claim = ["claim"];
  const response = await member.run.call(client, payload);

  t.strictSame(response, false);

  t.end();
});

test("Assign successfully if invite was found", async t => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const request = simple.mock(client.issues, "addAssigneesToIssue")
    .resolveWith({
      data: {
        assignees: ["octokitten"]
      }
    });

  const response = await member.run.call(client, payload);

  t.equals(client.invites.has("octokitten@zulip/zulipbot"), false);
  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.assignees, ["octokitten"]);
  t.equals(response, true);

  t.end();
});

test("Warn if issue assignment failed", async t => {
  client.invites.set("octokitten@zulip/zulipbot", 69);

  const request = simple.mock(client.issues, "addAssigneesToIssue")
    .resolveWith({
      data: {
        assignees: []
      }
    });

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  const request2 = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error
    }
  });

  const response = await member.run.call(client, payload);

  t.equals(client.invites.has("octokitten@zulip/zulipbot"), false);
  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.assignees, ["octokitten"]);
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.equals(request2.lastCall.arg.body, error);
  t.equals(response.data.body, error);

  t.end();
});

