const simple = require("simple-mock");
const test = require("tap").test;

const homePath = `${__dirname}/../../../src`;
const client = require(`${homePath}/client.js`);
const abandon = require(`${homePath}/commands/abandon.js`);

const payload = {
  repository: {
    owner: {
      login: "zulip",
    },
    name: "zulipbot",
  },
  issue: {
    number: 69,
    assignees: [
      {
        login: "octocat",
      },
    ],
  },
};

test("Reject if commenter isn't an assignee", async (t) => {
  const commenter = "octokitten";

  const error = "**ERROR:** You have not claimed this issue to work on yet.";
  const request = simple.mock(client.issues, "createComment").resolveWith({
    data: {
      body: error,
    },
  });

  const response = await abandon.run.call(client, payload, commenter);

  t.ok(request.called);
  t.equal(response.data.body, error);

  simple.restore();
  t.end();
});

test("Remove if commenter is assigned", async (t) => {
  const commenter = "octocat";

  const request = simple.mock(client.issues, "removeAssignees").resolveWith({
    data: {
      assignees: [],
    },
  });

  const response = await abandon.run.call(client, payload, commenter);

  t.ok(request.called);
  t.strictSame(response.data.assignees, []);

  simple.restore();
  t.end();
});
