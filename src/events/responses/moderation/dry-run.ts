import type { Bot } from "../../../bot.ts";
import type { Finding } from "../moderation.ts";

export type DryRunTarget = {
  kind: "pull_request" | "issue";
  number: number;
};

export type DryRunCommentAction = {
  action: "create" | "update" | "minimize";
  commentId?: number;
  body?: string;
  classifier?: string;
};

export type DryRunLabelChanges = {
  add?: readonly string[];
  remove?: readonly string[];
};

export type DryRunAssignmentChanges = {
  add?: readonly string[];
  remove?: readonly string[];
};

export type DryRunAction = {
  repository: string;
  target: DryRunTarget;
  findings?: readonly Finding[];
  comment?: DryRunCommentAction;
  labels?: DryRunLabelChanges;
  assignees?: DryRunAssignmentChanges;
  invitations?: readonly string[];
};

export type DryRunRecord = DryRunAction & {
  type: "moderation_dry_run";
  timestamp: string;
};

export function isDryRun(bot: Bot): boolean {
  return bot.cfg.pulls.moderation.dryRun;
}

/**
 * Write a proposed ZulipBot 2.0 moderation action as a single JSON line to
 * the bot's standard log output.
 */
export function recordDryRun(action: DryRunAction): DryRunRecord {
  const record: DryRunRecord = {
    type: "moderation_dry_run",
    timestamp: new Date().toISOString(),
    ...action,
  };
  console.log(JSON.stringify(record));
  return record;
}
