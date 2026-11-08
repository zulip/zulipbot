import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EmitterWebhookEvent } from "@octokit/webhooks/types";
import { assertDefined, assertPresent } from "ts-extras";
import type { Bot } from "../../bot.ts";

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

type PullRequest = EvaluatedPayload["pull_request"];
type Repository = EvaluatedPayload["repository"];
type Commit =
  RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"][number];
type File =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];

export type Finding = {
  check: string;
  message: string;
};

export type Check = (bot: Bot, context: Context) => Promise<Finding[]>;

// Findings are listed in the order their checks appear here.
export const checks: Check[] = [];

// The docs don't say how to mark a PR as work in progress, so titles
// use "[WIP]", "WIP:", "(wip)", and more. A leading "wip" in any case
// counts, as does the configured marker anywhere in the title.
const wipPrefix = /^\W*wip\b/iv;

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

export async function isEligible(
  bot: Bot,
  pull: PullRequest,
  repo: Repository,
) {
  if (pull.draft) return false;

  const marker = bot.cfg.pulls.status.wip;
  const isWip =
    wipPrefix.test(pull.title) ||
    (marker !== null && pull.title.includes(marker));
  if (isWip || pull.user === null) return false;

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
 * What the checks read about one pull request. Commits and files are
 * fetched once, on first use, and only when every page arrived.
 */
export class Context {
  readonly #bot: Bot;
  #commits?: Promise<Commit[]>;
  #files?: Promise<File[]>;
  readonly pull: PullRequest;
  readonly repo: Repository;

  constructor(bot: Bot, pull: PullRequest, repo: Repository) {
    this.#bot = bot;
    this.pull = pull;
    this.repo = repo;
  }

  #params() {
    return {
      owner: this.repo.owner.login,
      repo: this.repo.name,
      pull_number: this.pull.number,
      per_page: 100,
    };
  }

  // GitHub stops listing after 250 commits or 3000 files. A partial
  // list would miss findings, so it is an error rather than a result.
  // Without a count in the payload, a list that reaches the limit may
  // be partial.
  #complete<T>(
    items: T[],
    expected: number | undefined,
    limit: number,
    noun: string,
  ) {
    if (
      expected === undefined ? items.length >= limit : items.length < expected
    ) {
      throw new Error(
        `Listed ${items.length} of ${expected ?? "unknown"} ${noun} for ${this.repo.full_name}#${this.pull.number}`,
      );
    }

    return items;
  }

  async commits(): Promise<Commit[]> {
    const { octokit } = this.#bot;
    this.#commits ??= octokit
      .paginate(octokit.pulls.listCommits, this.#params())
      .then((items) =>
        this.#complete(items, this.pull.commits, 250, "commits"),
      );
    return this.#commits;
  }

  async files(): Promise<File[]> {
    const { octokit } = this.#bot;
    this.#files ??= octokit
      .paginate(octokit.pulls.listFiles, this.#params())
      .then((items) =>
        this.#complete(items, this.pull.changed_files, 3000, "files"),
      );
    return this.#files;
  }
}

// Each finding is a list item. Later lines of a finding are indented so
// they stay in its item.
function render(findings: readonly Finding[]) {
  return findings
    .map((finding) => `- ${finding.message.replaceAll("\n", "\n  ")}`)
    .join("\n");
}

/**
 * Keep one comment per pull request in step with the findings. It is
 * posted for the first findings, edited as they change, and edited to
 * the passing message once there are none. A pull request that never
 * had findings gets no comment.
 */
async function publish(
  bot: Bot,
  context: Context,
  findings: readonly Finding[],
) {
  const { pull, repo } = context;
  const report = bot.templates.get("moderationReport");
  const passing = bot.templates.get("moderationPassing");
  assertDefined(report);
  assertDefined(passing);
  // getComments only finds the bot's own comments, so without the bot's
  // login it would miss the comment and post a second one.
  assertDefined(bot.cfg.auth.username);
  assertPresent(pull.user);

  const [comment] = await report.getComments({
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: pull.number,
  });

  // Both messages mention the same author, so an edit never notifies
  // anyone new.
  const author = pull.user.login;
  const body =
    findings.length > 0
      ? report.format({ author, findings: render(findings) })
      : passing.format({ author });

  if (comment === undefined) {
    if (findings.length === 0) return;
    await bot.octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pull.number,
      body,
    });
  } else if (comment.body?.trimEnd() !== body.trimEnd()) {
    await bot.octokit.issues.updateComment({
      owner: repo.owner.login,
      repo: repo.name,
      comment_id: comment.id,
      body,
    });
  }
}

async function moderate(bot: Bot, payload: EvaluatedPayload) {
  const { pull_request: pull, repository: repo } = payload;
  if (!(await isEligible(bot, pull, repo))) return;

  const context = new Context(bot, pull, repo);
  const findings: Finding[] = [];
  for (const check of checks) {
    findings.push(...(await check(bot, context)));
  }

  await publish(bot, context, findings);
}

// Two events for one pull request can arrive together. Each would find
// no comment and post one, so they run one at a time, in the order they
// arrived.
const queues = new Map<string, Promise<void>>();

/**
 * Evaluate an eligible pull request against every check and update its
 * moderation comment.
 */
export const run = async function (bot: Bot, payload: PullPayload) {
  if (!bot.cfg.pulls.moderation.enabled || !shouldEvaluate(payload)) return;

  const key = `${payload.repository.full_name}#${payload.pull_request.number}`;
  const previous = queues.get(key) ?? Promise.resolve();
  // An earlier event's failure was already reported to its own caller.
  const current = previous
    .catch(() => undefined)
    .then(async () => moderate(bot, payload));
  queues.set(key, current);
  try {
    await current;
  } finally {
    if (queues.get(key) === current) queues.delete(key);
  }
};
