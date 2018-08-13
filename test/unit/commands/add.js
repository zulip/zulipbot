const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const add = require(`${homePath}/commands/add.js`);

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
      {name: "test"},
      {name: "test2"}
    ],
    user: {
      login: "octocat"
    }
  }
};

const repoLabels = [
  {name: "test"},
  {name: "test2"},
  {name: "bug"}
];

const template = client.templates.get("labelError");
template.content = "{labels} {labelList} {exist} {beState} {action} {type}.";
client.templates.set("labelError", template);

test("Reject if self-labelling enabled with different commenter", async t => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = "\"bug\"";

  const response = await add.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Reject if self-labelling users excludes commenter", async t => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"]
  };
  const commenter = "octokitten";
  const args = "\"bug\"";

  const response = await add.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Reject if invalid arguments were provided", async t => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await add.run.call(client, payload, commenter, args);

  t.is(response, false);

  t.end();
});

test("Add appropriate labels", async t => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = "\"bug\"";

  const request1 = simple.mock(client.util, "getAllPages")
    .resolveWith(repoLabels);

  const request2 = simple.mock(client.issues, "addLabels")
    .resolveWith({
      code: 200
    });

  const response = await add.run.call(client, payload, commenter, args);

  t.equals(request1.lastCall.args[0], "issues.getLabels");
  t.equals(request1.lastCall.args[1].owner, "zulip");
  t.equals(request1.lastCall.args[1].repo, "zulipbot");
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.strictSame(request2.lastCall.arg.labels, ["bug"]);
  t.equals(response.code, 200);

  simple.restore();
  t.end();
});

test("Add appropriate label and reject label not in repository", async t => {
  payload.issue.pull_request = true;
  const commenter = "octocat";
  const args = "\"bug\" \"invalid\"";

  const request1 = simple.mock(client.util, "getAllPages")
    .resolveWith(repoLabels);

  const request2 = simple.mock(client.issues, "addLabels")
    .resolveWith({
      code: 200
    });

  const error = "Label \"invalid\" does not exist was added to pull request.";

  const request3 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await add.run.call(client, payload, commenter, args);

  t.equals(request1.lastCall.args[0], "issues.getLabels");
  t.equals(request1.lastCall.args[1].owner, "zulip");
  t.equals(request1.lastCall.args[1].repo, "zulipbot");
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.strictSame(request2.lastCall.arg.labels, ["bug"]);
  t.equals(request3.lastCall.arg.body, error);
  t.equals(response.code, 200);

  simple.restore();
  t.end();
});

test("Add appropriate labels and reject labels not in repository", async t => {
  payload.issue.pull_request = false;
  const commenter = "octocat";
  const args = "\"bug\" \"a\" \"b\"";

  const request1 = simple.mock(client.util, "getAllPages")
    .resolveWith(repoLabels);

  const request2 = simple.mock(client.issues, "addLabels")
    .resolveWith({
      code: 200
    });

  const error = "Labels \"a\", \"b\" do not exist were added to issue.";

  const request3 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await add.run.call(client, payload, commenter, args);

  t.equals(request1.lastCall.args[0], "issues.getLabels");
  t.equals(request1.lastCall.args[1].owner, "zulip");
  t.equals(request1.lastCall.args[1].repo, "zulipbot");
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.strictSame(request2.lastCall.arg.labels, ["bug"]);
  t.equals(request3.lastCall.arg.body, error);
  t.equals(response.code, 200);

  simple.restore();
  t.end();
});

test("Add appropriate labels and reject already added label", async t => {
  payload.issue.pull_request = true;
  const commenter = "octocat";
  const args = "\"bug\" \"test\"";

  const request1 = simple.mock(client.util, "getAllPages")
    .resolveWith(repoLabels);

  const request2 = simple.mock(client.issues, "addLabels")
    .resolveWith({
      code: 200
    });

  const error = "Label \"test\" already exists was added to pull request.";

  const request3 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await add.run.call(client, payload, commenter, args);

  t.equals(request1.lastCall.args[0], "issues.getLabels");
  t.equals(request1.lastCall.args[1].owner, "zulip");
  t.equals(request1.lastCall.args[1].repo, "zulipbot");
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.strictSame(request2.lastCall.arg.labels, ["bug"]);
  t.equals(request3.lastCall.arg.body, error);
  t.equals(response.code, 200);

  simple.restore();
  t.end();
});

test("Add appropriate labels and reject already added labels", async t => {
  payload.issue.pull_request = false;
  const commenter = "octocat";
  const args = "\"test\" \"test2\"";

  const request1 = simple.mock(client.util, "getAllPages")
    .resolveWith(repoLabels);

  const request2 = simple.mock(client.issues, "addLabels")
    .resolveWith({
      code: 200
    });

  const error = "Labels \"test\", \"test2\" already exist were added to issue.";

  const request3 = simple.mock(client.issues, "createComment")
    .resolveWith({
      data: {
        body: error
      }
    });

  const response = await add.run.call(client, payload, commenter, args);

  t.equals(request1.lastCall.args[0], "issues.getLabels");
  t.equals(request1.lastCall.args[1].owner, "zulip");
  t.equals(request1.lastCall.args[1].repo, "zulipbot");
  t.equals(request2.lastCall.arg.owner, "zulip");
  t.equals(request2.lastCall.arg.repo, "zulipbot");
  t.equals(request2.lastCall.arg.number, 69);
  t.strictSame(request2.lastCall.arg.labels, []);
  t.equals(request3.lastCall.arg.body, error);
  t.equals(response.code, 200);

  simple.restore();
  t.end();
});
