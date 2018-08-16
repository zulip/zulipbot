const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const abandon = require(`${homePath}/commands/abandon.js`);

const payload = {
  repository: {
    owner: {
      login: "zulip"
    },
    name: "zulipbot"
  },
  issue: {
    number: 69,
    assignees: [{
      login: "octocat"
    }]
  }
};

test("Reject if commenter isn't an assignee", async t => {
  const commenter = "octokitten";

  const error = "**ERROR:** You have not claimed this issue to work on yet.";
  const request = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error
    }
  });

  const response = await abandon.run.call(client, payload, commenter);

  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.equals(request.lastCall.arg.body, error);
  t.equals(response.data.body, error);

  simple.restore();
  t.end();
});

test("Remove if commenter is assigned", async t => {
  const commenter = "octocat";

  const request = simple.mock(client.issues, "removeAssigneesFromIssue")
    .resolveWith({
      data: {
        assignees: []
      }
    });

  const response = await abandon.run.call(client, payload, commenter);

  t.equals(request.lastCall.arg.owner, "zulip");
  t.equals(request.lastCall.arg.repo, "zulipbot");
  t.equals(request.lastCall.arg.number, 69);
  t.strictSame(request.lastCall.arg.assignees, ["octocat"]);
  t.strictSame(response.data.assignees, []);

  simple.restore();
  t.end();
});
