import assert from "node:assert";

import nock from "nock";
import { partialMock } from "partial-mock";
import { test } from "tap";

import client from "../../../src/client.ts";
import * as abandon from "../../../src/commands/abandon.ts";
import type { CommandPayload } from "../../../src/commands/index.ts";

const payload: CommandPayload = partialMock({
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
});

void test("Reject if commenter isn't an assignee", async (t) => {
  const commenter = "octokitten";

  const error = "**ERROR:** You have not claimed this issue to work on yet.";
  const scope = nock("https://api.github.com")
    .post("/repos/zulip/zulipbot/issues/69/comments", { body: error })
    .reply(200, { body: error });

  const response = await abandon.run.call(client, payload, commenter);

  t.equal(response.data.body, error);

  scope.done();
});

void test("Remove if commenter is assigned", async (t) => {
  const commenter = "octocat";

  const scope = nock("https://api.github.com")
    .delete("/repos/zulip/zulipbot/issues/69/assignees", {
      assignees: ["octocat"],
    })
    .reply(200, { assignees: [] });

  const response = await abandon.run.call(client, payload, commenter);

  assert.ok("assignees" in response.data);
  t.strictSame(response.data.assignees, []);

  scope.done();
});
