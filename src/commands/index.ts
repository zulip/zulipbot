import type { EmitterWebhookEvent } from "@octokit/webhooks/types";

import type { Client } from "../client.ts";

import * as abandon from "./abandon.ts";
import * as add from "./add.ts";
import * as claim from "./claim.ts";
import * as remove from "./remove.ts";

export type CommandPayload = EmitterWebhookEvent<
  "issues" | "issue_comment"
>["payload"] & {
  action: "opened" | "created";
};

export type CommandAliases = Client["cfg"]["issues"]["commands"];

export default [abandon, add, claim, remove];
