import process from "node:process";
import { test, type TestContext } from "node:test";
import { RequestError } from "@octokit/request-error";
import nock from "nock";
import { Client } from "../../src/client.ts";

/**
 * The shared `client` singleton has throttling disabled under
 * `NODE_ENV=test` (see client.ts), so its retry/throttle hooks never run
 * against real requests in the rest of the test suite. To exercise them
 * here, construct a separate client with throttling enabled by flipping
 * `NODE_ENV` just for the constructor call, then restoring it.
 */

function createThrottledClient() {
  const originalEnv = process.env["NODE_ENV"];
  process.env["NODE_ENV"] = "production";
  try {
    return new Client();
  } finally {
    process.env["NODE_ENV"] = originalEnv;
  }
}

void test("client: Retries once after a secondary rate limit, then succeeds", async (t: TestContext) => {
  const throttledClient = createThrottledClient();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/1")
    .reply(
      403,
      { message: "You have exceeded a secondary rate limit" },
      { "retry-after": "1" },
    )
    .get("/repos/zulip/zulipbot/pulls/1")
    .reply(200, { number: 1 });

  const response = await throttledClient.pulls.get({
    owner: "zulip",
    repo: "zulipbot",
    pull_number: 1,
  });

  t.assert.strictEqual(response.data.number, 1);
  scope.done();
});

void test("client: Aborts after repeated secondary rate limits", async (t: TestContext) => {
  const throttledClient = createThrottledClient();

  const scope = nock("https://api.github.com")
    .get("/repos/zulip/zulipbot/pulls/2")
    .times(4)
    .reply(
      403,
      { message: "You have exceeded a secondary rate limit" },
      { "retry-after": "1" },
    );

  await t.assert.rejects(
    throttledClient.pulls.get({
      owner: "zulip",
      repo: "zulipbot",
      pull_number: 2,
    }),
    (error: unknown) => error instanceof RequestError && error.status === 403,
  );

  scope.done();
});
