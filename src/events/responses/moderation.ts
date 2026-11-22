import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import type { Bot } from "../../bot.ts";
import { isWip } from "./pull-state.ts";

type PullPayload = EmitterWebhookEvent<"pull_request">["payload"];

// Becoming a draft is not evaluated, so the existing comment and labels
// stay as they are until the pull request is ready for review again.
type EvaluatedPayload = EmitterWebhookEvent<
  | "pull_request.opened"
  | "pull_request.reopened"
  | "pull_request.synchronize"
  | "pull_request.ready_for_review"
  | "pull_request.edited"
>["payload"];

type PullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type Repository = EvaluatedPayload["repository"];
type File =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];

export type Finding = {
  check: string;
  message: string;
};

export type Check = (bot: Bot, context: Context) => Promise<Finding[]>;

// Findings are listed in the order their checks appear here.
export const checks: Check[] = [];

const evaluatedActions = new Set<PullPayload["action"]>([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);

export function shouldEvaluate(
  payload: PullPayload,
): payload is EvaluatedPayload {
  if (payload.pull_request.state !== "open") return false;

  if (payload.action === "edited") {
    const { changes } = payload;
    // A title edit can add or remove the WIP marker, and a new base
    // changes the commits without a push.
    return (
      changes.body !== undefined ||
      changes.title !== undefined ||
      changes.base !== undefined
    );
  }

  return evaluatedActions.has(payload.action);
}

/**
 * Moderation checks only run for first-time contributors, meaning
 * authors with no commits in the repository. Their pull request must
 * also be open, not a draft, and not marked as work in progress.
 */
export async function isEligible(
  bot: Bot,
  pull: PullRequest,
  repo: Repository,
) {
  if (pull.state !== "open" || pull.draft === true || isWip(bot, pull.title)) {
    return false;
  }

  // The same contributor lookup as `claim`: one commit by the author in
  // the repository is enough. A failed request throws instead of
  // counting the author as new.
  const response = await bot.octokit.repos.listCommits({
    owner: repo.owner.login,
    repo: repo.name,
    author: pull.user.login,
    per_page: 1,
  });
  return response.data.length === 0;
}

/**
 * What the checks read about one pull request. Files are fetched once,
 * on first use, and only when every page arrived.
 */
export class Context {
  readonly #bot: Bot;
  #files?: Promise<File[]>;
  readonly pull: PullRequest;
  readonly repo: Repository;

  constructor(bot: Bot, pull: PullRequest, repo: Repository) {
    this.#bot = bot;
    this.pull = pull;
    this.repo = repo;
  }

  async files(): Promise<File[]> {
    const { octokit } = this.#bot;
    this.#files ??= octokit
      .paginate(octokit.pulls.listFiles, {
        owner: this.repo.owner.login,
        repo: this.repo.name,
        pull_number: this.pull.number,
        per_page: 100,
      })
      .then((files) => {
        // GitHub stops listing after 3000 files, so a list that long may
        // be partial and miss findings. A shorter list is complete. It
        // isn't compared with the PR's file count, which a push between
        // the two requests can change.
        if (files.length >= 3000) {
          throw new Error(
            `Listed ${files.length} files for ${this.repo.full_name}#${this.pull.number}, GitHub's limit`,
          );
        }

        return files;
      });
    return this.#files;
  }
}

/**
 * Evaluate an eligible pull request against every check. Returns
 * `undefined` when the pull request was not evaluated.
 */
export const run = async function (bot: Bot, payload: PullPayload) {
  if (!bot.cfg.pulls.moderation.enabled || !shouldEvaluate(payload)) return;

  const { repository: repo } = payload;
  // Events can arrive out of order, so fetch the latest version of the
  // pull request.
  const { data: pull } = await bot.octokit.pulls.get({
    owner: repo.owner.login,
    repo: repo.name,
    pull_number: payload.pull_request.number,
  });
  if (!(await isEligible(bot, pull, repo))) return;

  const context = new Context(bot, pull, repo);
  const findings: Finding[] = [];
  for (const check of checks) {
    findings.push(...(await check(bot, context)));
  }

  return findings;
};
