import { RequestError } from "@octokit/request-error";
import type { Bot } from "../bot.ts";

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checks whether a user belongs to the team configured in
 * `issues.commands.assign.warn.exemptTeam`, in the given organization.
 * Members of that team are exempt from the moderation of claims on issues
 * that aren't open for claiming.
 *
 * Reading team membership needs the "Members: read" organization permission
 * (the `read:org` scope for a personal access token).
 *
 * @returns Whether the user is an active member of the team, or undefined if
 * GitHub returned an unexpected error, which is logged.
 */
export async function isExempt(
  bot: Bot,
  org: string,
  username: string,
): Promise<boolean | undefined> {
  const team = bot.cfg.issues.commands.assign.warn.exemptTeam;
  if (team === null) return false;

  try {
    const response = await bot.octokit.teams.getMembershipForUserInOrg({
      org,
      team_slug: team,
      username,
    });
    return response.data.state === "active";
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) return false;
    bot.octokit.log.warn(
      `Couldn't check whether ${username} is a member of ${org}/${team}: ${describe(error)}`,
    );
    return undefined;
  }
}

/**
 * Hides (minimizes) a comment as off-topic. The REST API can't minimize
 * comments, so this uses the GraphQL `minimizeComment` mutation, which needs
 * write access to the repository's issues and pull requests.
 *
 * A failure is logged rather than thrown, so that it doesn't stop the caller
 * from posting its own reply.
 *
 * @param bot The bot whose token is used.
 * @param nodeId GraphQL node ID of the comment.
 */
export async function hideComment(bot: Bot, nodeId: string) {
  try {
    await bot.octokit.graphql(
      `mutation ($id: ID!) {
        minimizeComment(input: { subjectId: $id, classifier: OFF_TOPIC }) {
          minimizedComment {
            isMinimized
          }
        }
      }`,
      { id: nodeId },
    );
  } catch (error) {
    bot.octokit.log.warn(`Couldn't hide comment ${nodeId}: ${describe(error)}`);
  }
}
