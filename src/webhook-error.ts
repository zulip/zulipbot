import type { WebhookEventHandlerError } from "@octokit/webhooks/types";

/**
 * Formats a webhook handler error for logging: the event name, delivery id,
 * and stack trace of the first error that caused the handler to fail.
 */

export function formatWebhookError(error: WebhookEventHandlerError) {
  return `Error handling ${error.event.name} event (id: ${error.event.id}):\n${error.stack}`;
}
