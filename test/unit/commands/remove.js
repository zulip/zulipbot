const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const remove = require(`${homePath}/commands/remove.js`);

const payload = {
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    pull_request: true,
    number: 69,
    labels: [{ name: "bug" }, { name: "help wanted" }],
    user: {
      login: "octocat",
    },
  },
};

const template = client.templates.get("labelError");
template.content = "{labels} {labelList} {exist} {beState} {action} {type}.";
client.templates.set("labelError", template);

test("Reject if self-labelling enabled with different commenter", async (t) => {
  client.cfg.issues.commands.label.self = true;
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);

  t.end();
});

test("Reject if self-labelling users excludes commenter", async (t) => {
  client.cfg.issues.commands.label.self = {
    users: ["octocat"],
  };
  const commenter = "octokitten";
  const args = '"bug"';

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);

  t.end();
});

test("Reject if invalid arguments were provided", async (t) => {
  const commenter = "octocat";
  const args = "no arguments";

  const response = await remove.run.call(client, payload, commenter, args);

  t.notOk(response);

  t.end();
});

test("Remove appropriate labels", async (t) => {
  client.cfg.issues.commands.label.self = false;
  const commenter = "octocat";
  const args = '"bug"';

  const request = simple.mock(client.issues, "replaceLabels").resolveWith();

  await remove.run.call(client, payload, commenter, args);

  t.strictSame(request.lastCall.arg.labels, ["help wanted"]);

  simple.restore();
  t.end();
});

test("Remove appropriate labels with single rejection message", async (t) => {
  const commenter = "octocat";
  const args = '"help wanted" "test"';

  const request = simple.mock(client.issues, "replaceLabels").resolveWith();

  const error = 'Label "test" does not exist was removed from pull request.';

  const request2 = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error,
    },
  });

  await remove.run.call(client, payload, commenter, args);

  t.strictSame(request.lastCall.arg.labels, ["bug"]);
  t.equal(request2.lastCall.arg.body, error);

  simple.restore();
  t.end();
});

test("Remove appropriate labels with multiple rejection message", async (t) => {
  payload.issue.pull_request = false;
  const commenter = "octocat";
  const args = '"help wanted" "a" "b"';

  const request = simple.mock(client.issues, "replaceLabels").resolveWith();

  const error = 'Labels "a", "b" do not exist were removed from issue.';

  const request2 = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error,
    },
  });

  await remove.run.call(client, payload, commenter, args);

  t.strictSame(request.lastCall.arg.labels, ["bug"]);
  t.equal(request2.lastCall.arg.body, error);

  simple.restore();
  t.end();
});
