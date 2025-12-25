import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import { test } from "tap";

import client from "../../../src/client.ts";
import * as pull from "../../../src/events/pull.ts";

const payload: EmitterWebhookEvent<
  "pull_request" | "pull_request_review"
>["payload"] = partialMock({
  action: "opened",
  pull_request: {
    number: 69,
    title: "Fix all the bugs",
    user: { login: "octocat" },
    body: null,
  },

  repository: {
    owner: { login: "zulip" },
    name: "zulipbot",
  },
});

void test("Ignore empty body", async () => {
  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/issues/69/labels")
    .reply(200, [{ name: "enhancement" }])
    .get("/repos/zulip/zulipbot/pulls/69/files")
    .reply(200, [])
    .put("/repos/zulip/zulipbot/issues/69/labels", {
      labels: ["enhancement", "size: XS"],
    })
    .reply(200)
    .get("/repos/zulip/zulipbot/pulls/69/commits")
    .reply(200, [{ commit: { message: "Fix all the bugs" } }])
    .get("/repos/zulip/zulipbot/issues/69/comments")
    .reply(200, []);
  await pull.run.call(client, payload);

  scope.done();
});
