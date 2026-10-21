import { test, type TestContext } from "node:test";
import type { WebhookEventHandlerError } from "@octokit/webhooks/types";
import { partialMock } from "partial-mock";
import { formatWebhookError } from "../../src/webhook-error.ts";

void test("webhook-error: Formats event name, delivery id, and stack trace", (t: TestContext) => {
  const error: WebhookEventHandlerError = partialMock({
    event: { name: "issues", id: "abc-123" },
    stack: "Error: boom\n    at somewhere",
  });

  t.assert.strictEqual(
    formatWebhookError(error),
    "Error handling issues event (id: abc-123):\nError: boom\n    at somewhere",
  );
});
