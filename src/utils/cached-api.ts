/**
 * Cached API call helpers
 * These wrappers cache frequently accessed data to reduce API calls
 */

import type { components } from "@octokit/openapi-types";
import type { Client } from "../client.ts";

/**
 * Get issue labels with caching
 * Labels don't change frequently within webhook processing window
 */
export async function getCachedIssueLabels(
  client: Client,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Array<components["schemas"]["label"]>> {
  const cacheKey = `labels:${owner}:${repo}:${issueNumber}`;
  
  const cached = client.getCached<Array<components["schemas"]["label"]>>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await client.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  client.setCached(cacheKey, response.data);
  return response.data;
}

/**
 * Get pull request details with caching
 */
export async function getCachedPullRequest(
  client: Client,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<components["schemas"]["pull-request"]> {
  const cacheKey = `pull:${owner}:${repo}:${pullNumber}`;

  const cached = client.getCached<components["schemas"]["pull-request"]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await client.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  client.setCached(cacheKey, response.data);
  return response.data;
}

/**
 * Get issue details with caching
 * Note: In GitHub's API, pull requests are also issues
 */
export async function getCachedIssue(
  client: Client,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<components["schemas"]["issue"]> {
  const cacheKey = `issue:${owner}:${repo}:${issueNumber}`;

  const cached = client.getCached<components["schemas"]["issue"]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await client.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  client.setCached(cacheKey, response.data);
  return response.data;
}

/**
 * Check if user is a collaborator (with caching)
 * Collaborator status rarely changes during event processing
 */
export async function isCachedCollaborator(
  client: Client,
  owner: string,
  repo: string,
  username: string,
): Promise<boolean> {
  const cacheKey = `collaborator:${owner}:${repo}:${username}`;
  
  const cached = client.getCached<boolean>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    await client.repos.checkCollaborator({
      owner,
      repo,
      username,
    });
    client.setCached(cacheKey, true);
    return true;
  } catch {
    client.setCached(cacheKey, false);
    return false;
  }
}

/**
 * Invalidate cache for an issue when it's updated
 * Call this when labels or other issue data changes
 */
export function invalidateIssueCache(
  client: Client,
  owner: string,
  repo: string,
  issueNumber: number,
): void {
  client.clearCached(`labels:${owner}:${repo}:${issueNumber}`);
  client.clearCached(`pull:${owner}:${repo}:${issueNumber}`);
  client.clearCached(`issue:${owner}:${repo}:${issueNumber}`);
}

/**
 * Invalidate collaborator cache when permissions change
 */
export function invalidateCollaboratorCache(
  client: Client,
  owner: string,
  repo: string,
  username: string,
): void {
  client.clearCached(`collaborator:${owner}:${repo}:${username}`);
}
