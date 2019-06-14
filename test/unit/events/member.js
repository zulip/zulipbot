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

  t.notOk(response);

  t.end();
});

test("Ignore if there aren't any claim command aliases", async t => {
  payload.action = "added";
  client.cfg.issues.commands.assign.claim = [];
  const response = await member.run.call(client, payload);

  t.notOk(response);

  t.end();
});

test("Ignore if there aren't any recorded invites", async t => {
  client.cfg.issues.commands.assign.claim = ["claim"];
  const response = await member.run.call(client, payload);

  t.notOk(response);

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

  t.notOk(client.invites.has("octokitten@zulip/zulipbot"));
  t.deepIs(request.lastCall.arg.assignees, ["octokitten"]);
  t.ok(response);

  simple.restore();
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

  await member.run.call(client, payload);

  t.notOk(client.invites.has("octokitten@zulip/zulipbot"));
  t.deepIs(request.lastCall.arg.assignees, ["octokitten"]);
  t.is(request2.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

