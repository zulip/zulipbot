const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const remove = require(`${homePath}/commands/remove.js`);

const payload = {
  repository: {
    owner: {
      login: "zulip"
    },
    name: "zulipbot"
  },
  issue: {
    pull_request: false,
    number: 69,
    labels: [
      {name: "bug"},
      {name: "help wanted"}
    ],
    user: {
      login: "octocat"
    }
  }
};

test("Reject if self-labelling enabled with different commenter", async t => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = "\"bug\"";

  const response = await remove.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Reject if self-labelling users excludes commenter", async t => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"]
  };
  const commenter = "octokitten";
  const args = "\"bug\"";

  const response = await remove.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Reject if invalid arguments were provided", async t => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await remove.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Remove appropriate labels", async t => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = "\"bug\"";

  const request = simple.mock(client.issues, "replaceAllLabels")
    .resolveWith({
      code: 200
    });

  const response = await remove.run.call(client, payload, commenter, args);

  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.labels, ["help wanted"]);
  t.equals(response, true);

  simple.restore();
  t.end();
});

test("Remove appropriate labels with single rejection message", async t => {
  payload.issue.pull_request = false;
  const commenter = "octocat";
  const args = "\"help wanted\" \"enhancement\"";

  const request = simple.mock(client.issues, "replaceAllLabels")
    .resolveWith({
      code: 200
    });

  const error = "**ERROR:** Label \"enhancement\" does not exist and was thus not removed from this issue.";

  const request2 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await remove.run.call(client, payload, commenter, args);

  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.labels, ["bug"]);
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.equals(request2.lastCall.arg.body, error);
  t.equals(response.data.body, error);

  simple.restore();
  t.end();
});

test("Remove appropriate labels with multiple rejection message", async t => {
  payload.issue.pull_request = true;
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = "\"help wanted\" \"enhancement\" \"duplicate\"";

  const request = simple.mock(client.issues, "replaceAllLabels")
    .resolveWith({
      code: 200
    });

  const error = "**ERROR:** Labels \"enhancement\", \"duplicate\" do not exist and were thus not removed from this pull request.";

  const request2 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await remove.run.call(client, payload, commenter, args);

  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.labels, ["bug"]);
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.equals(request2.lastCall.arg.body, error);
  t.equals(response.data.body, error);

  simple.restore();
  t.end();
});
