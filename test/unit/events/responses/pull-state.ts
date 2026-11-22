import { test, type TestContext } from "node:test";
import { bot } from "../../../../src/bot.ts";
import { isWip } from "../../../../src/events/responses/pull-state.ts";

void test("pull-state: Titles marking work in progress are WIP", (t: TestContext) => {
  const titles = [
    "WIP: compose: Fix the typo.",
    "[wip] compose: Fix the typo.",
    "[ai] [WIP] compose: Fix the typo.",
    "compose: Fix the typo. (wip)",
  ];
  t.assert.deepStrictEqual(
    titles.map((title) => isWip(bot, title)),
    [true, true, true, true],
  );
});

void test("pull-state: Words that contain wip are not WIP", (t: TestContext) => {
  t.assert.strictEqual(
    isWip(bot, "drafts: Wipe saved drafts on logout."),
    false,
  );
});

void test("pull-state: Nothing is WIP without a configured pattern", (t: TestContext) => {
  const { wip } = bot.cfg.pulls.status;
  bot.cfg.pulls.status.wip = null;
  try {
    t.assert.strictEqual(isWip(bot, "WIP: compose: Fix the typo."), false);
  } finally {
    bot.cfg.pulls.status.wip = wip;
  }
});
