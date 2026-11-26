import { test, type TestContext } from "node:test";
import { bot } from "../../../../../src/bot.ts";
import {
  isDryRun,
  recordDryRun,
} from "../../../../../src/events/responses/moderation/dry-run.ts";

void test("dry-run: Reflects pulls.moderation.dryRun configuration", (t: TestContext) => {
  const wasDryRun = bot.cfg.pulls.moderation.dryRun;
  try {
    bot.cfg.pulls.moderation.dryRun = false;
    t.assert.strictEqual(isDryRun(bot), false);

    bot.cfg.pulls.moderation.dryRun = true;
    t.assert.strictEqual(isDryRun(bot), true);
  } finally {
    bot.cfg.pulls.moderation.dryRun = wasDryRun;
  }
});

void test("dry-run: Writes one JSON line per proposed moderation action", (t: TestContext) => {
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => {
    lines.push(line);
  });

  const record = recordDryRun({
    repository: "zulip/zulip",
    target: { kind: "issue", number: 42 },
    findings: [
      { check: "screenshots", message: "Add a screenshot.\nSecond line." },
    ],
    comment: { action: "minimize", commentId: 99, classifier: "OFF_TOPIC" },
    labels: { add: ["needs work"], remove: ["needs review"] },
    assignees: { remove: ["octocat"] },
    invitations: ["newcomer"],
  });

  t.assert.strictEqual(lines.length, 1);
  t.assert.strictEqual(lines[0]?.includes("\n"), false);

  const parsed: unknown = JSON.parse(lines[0] ?? "");
  t.assert.deepStrictEqual(parsed, record);
  t.assert.strictEqual(record.type, "moderation_dry_run");
  t.assert.strictEqual(Number.isNaN(Date.parse(record.timestamp)), false);
  t.assert.strictEqual(record.repository, "zulip/zulip");
  t.assert.deepStrictEqual(record.target, { kind: "issue", number: 42 });
});
