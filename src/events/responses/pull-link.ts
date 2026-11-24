import { RequestError } from "@octokit/request-error";
import _ from "lodash";
import type { Bot } from "../../bot.ts";
import { isOpenForClaiming } from "../../commands/claim.ts";
import type { CommandPayload } from "../../commands/index.ts";
import { hideComment, isExempt } from "../../structures/off-topic.ts";

// Bounds the API requests made for one comment.
const maxReferences = 5;

/**
 * Finds pull request numbers that a comment may refer to in its own
 * repository: `#123`, or a link to `https://github.com/{owner}/{repo}/pull/123`.
 *
 * @returns Unique numbers, in order of appearance.
 */
export function findReferences(body: string, owner: string, repo: string) {
  const regex = new RegExp(
    String.raw`(?<![\w\/])#(\d+)\b|https:\/\/github\.com\/${_.escapeRegExp(owner)}\/${_.escapeRegExp(repo)}\/pull\/(\d+)`,
    "giv",
  );
  const numbers = Array.from(body.matchAll(regex), (match) =>
    Number(match[1] ?? match[2]),
  );
  return [...new Set(numbers)];
}

async function isOwnPullRequest(
  bot: Bot,
  owner: string,
  repo: string,
  number: number,
  commenter: string,
) {
  try {
    const response = await bot.octokit.issues.get({
      owner,
      repo,
      issue_number: number,
    });
    return (
      response.data.pull_request !== undefined &&
      response.data.user?.login === commenter
    );
  } catch (error) {
    if (!(error instanceof RequestError && error.status === 404)) {
      bot.octokit.log.warn(
        `Couldn't look up ${owner}/${repo}#${number}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return false;
  }
}

/**
 * Hides a comment that links to the commenter's own pull request, on an issue
 * that isn't open for claiming. Such comments announce work on an issue that
 * nobody was asked to pick up. Links to other people's pull requests and to
 * issues are left alone, as are comments by members of the exempt team.
 */
export async function run(bot: Bot, payload: CommandPayload) {
  // Only comments on issues, not issue bodies or pull requests.
  const isPull = payload.issue.pull_request !== undefined;
  if (
    isPull ||
    !("comment" in payload) ||
    isOpenForClaiming(bot, payload.issue)
  ) {
    return;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const commenter = payload.comment.user?.login;
  if (commenter === undefined) return;

  const numbers = findReferences(payload.comment.body, owner, repo)
    .filter((number) => number !== payload.issue.number)
    .slice(0, maxReferences);

  for (const number of numbers) {
    if (await isOwnPullRequest(bot, owner, repo, number, commenter)) {
      if ((await isExempt(bot, owner, commenter)) === false) {
        await hideComment(bot, payload.comment.node_id);
      }

      return;
    }
  }
}
