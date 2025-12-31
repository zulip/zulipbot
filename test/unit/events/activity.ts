import nock from "nock";
import { test } from "tap";

import client from "../../../src/client.ts";
import { activity } from "../../../src/events/index.ts";

void test("Handle multiple and missing issue references", async () => {
  client.cfg.activity.check.repositories = ["zulip/zulip"];

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls")
    .reply(200, [
      {
        base: { repo: { name: "zulip", owner: { login: "zulip" } } },
        number: 1,
        body: "Fixes #2, fixes #3, fixes #4",
        updated_at: new Date().toISOString(),
      },
    ])
    .get("/repos/zulip/zulip/issues/1/labels")
    .reply(200, [])
    .get("/repos/zulip/zulip/issues/2")
    .reply(404)
    .get("/repos/zulip/zulip/issues/3")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/issues/4")
    .reply(200, { pull_request: false, state: "open" })
    .get("/repos/zulip/zulip/pulls/1/commits")
    .reply(200, [])
    .get("/issues?filter=all&labels=in%20progress")
    .reply(200, []);

  await activity.run.call(client);

  scope.done();
});
