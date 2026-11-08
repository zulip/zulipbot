import { test, type TestContext } from "node:test";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import nock from "nock";
import { partialMock } from "partial-mock";
import { bot } from "../../../../../src/bot.ts";
import { Context } from "../../../../../src/events/responses/moderation.ts";
import { screenshots } from "../../../../../src/events/responses/moderation/screenshots.ts";

nock.disableNetConnect();

function context(body: string | null) {
  const payload: EmitterWebhookEvent<"pull_request.opened">["payload"] =
    partialMock({
      pull_request: { number: 12, body, changed_files: 2 },
      repository: {
        name: "zulip",
        full_name: "zulip/zulip",
        owner: { login: "zulip" },
      },
    });
  return new Context(bot, payload.pull_request, payload.repository);
}

function changedFiles(...filenames: string[]) {
  return nock("https://api.github.com")
    .get("/repos/zulip/zulip/pulls/12/files")
    .query({ per_page: "100" })
    .reply(
      200,
      filenames.map((filename) => ({ filename })),
    );
}

void test("screenshots: Asks for screenshots of UI changes", async (t: TestContext) => {
  const scope = changedFiles("zerver/views/home.py", "web/styles/zulip.css");
  const findings = await screenshots(bot, context("Fixes #123."));
  t.assert.strictEqual(findings.length, 1);
  t.assert.match(findings[0]?.message ?? "", /`web\/styles\/zulip\.css`/v);
  scope.done();
});

void test("screenshots: Accepts images and videos in the description", async (t: TestContext) => {
  const descriptions = [
    "Before: ![before](https://example.com/b)",
    '<img width="400" src="https://example.com/b">',
    "https://github.com/user-attachments/assets/0b1c2d3e-aaaa-bbbb-cccc-000000000000",
  ];
  const results = await Promise.all(
    descriptions.map(async (body) => screenshots(bot, context(body))),
  );
  t.assert.deepStrictEqual(
    results,
    descriptions.map(() => []),
  );
});

void test("screenshots: Ignores changes outside the UI paths", async (t: TestContext) => {
  const scope = changedFiles("zerver/views/home.py", "docs/index.md");
  t.assert.deepStrictEqual(await screenshots(bot, context(null)), []);
  scope.done();
});
