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
      pull_request: { number: 12, body },
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

// The changed file's name as the finding quotes it.
async function quoted(filename: string) {
  const scope = changedFiles("zerver/views/home.py", filename);
  const [finding] = await screenshots(bot, context("Fixes #123."));
  scope.done();
  return /such as (?<name>.*), but its/v.exec(finding?.message ?? "")?.groups?.[
    "name"
  ];
}

void test("screenshots: Quotes a filename with backticks in a longer fence", async (t: TestContext) => {
  t.assert.strictEqual(
    await quoted("web/styles/a`b.css"),
    "``web/styles/a`b.css``",
  );
  t.assert.strictEqual(
    await quoted("web/styles/a``"),
    "``` web/styles/a`` ```",
  );
});

void test("screenshots: Quotes a filename with line breaks on one line", async (t: TestContext) => {
  t.assert.strictEqual(
    await quoted("web/styles/a\n\n@zulip/server-committers\r\n.css"),
    "`web/styles/a  @zulip/server-committers .css`",
  );
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
