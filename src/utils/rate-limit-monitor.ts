/**
 * Rate limit monitoring utilities
 * Helps track and log rate limit status to identify bottlenecks
 */

import type { Client } from "../client.ts";

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

// Cache rate limit status to avoid excessive API calls
// The rate limit check itself consumes 1 API call
let cachedRateLimitStatus: RateLimitStatus | null = null;
let cachedRateLimitTimestamp = 0;
const RATE_LIMIT_CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Check current rate limit status from GitHub API
 * Uses cached value if available to reduce API calls
 * @param forceRefresh - Force a fresh API call instead of using cache
 */
export async function checkRateLimit(
  client: Client,
  forceRefresh = false,
): Promise<RateLimitStatus> {
  const now = Date.now();

  // Return cached status if available and not expired
  if (
    !forceRefresh &&
    cachedRateLimitStatus &&
    now - cachedRateLimitTimestamp < RATE_LIMIT_CACHE_TTL
  ) {
    return cachedRateLimitStatus;
  }

  // Fetch fresh rate limit data
  const response = await client.rateLimit.get();
  const core = response.data.resources.core;

  cachedRateLimitStatus = {
    limit: core.limit,
    remaining: core.remaining,
    reset: new Date(core.reset * 1000),
    used: core.used,
  };
  cachedRateLimitTimestamp = now;

  return cachedRateLimitStatus;
}

/**
 * Log rate limit status with warning thresholds
 * @param forceRefresh - Force a fresh API call instead of using cache
 */
export async function logRateLimit(
  client: Client,
  forceRefresh = false,
): Promise<void> {
  const status = await checkRateLimit(client, forceRefresh);
  const percentUsed = (status.used / status.limit) * 100;

  const cacheIndicator = forceRefresh ? "" : " (cached)";

  if (percentUsed >= 90) {
    client.log.error(
      `Critical: ${percentUsed.toFixed(1)}% of rate limit used (${status.remaining}/${status.limit} remaining). Reset at ${status.reset.toISOString()}${cacheIndicator}`,
    );
  } else if (percentUsed >= 75) {
    client.log.warn(
      `Warning: ${percentUsed.toFixed(1)}% of rate limit used (${status.remaining}/${status.limit} remaining). Reset at ${status.reset.toISOString()}${cacheIndicator}`,
    );
  } else {
    client.log.info(
      `Rate limit: ${status.remaining}/${status.limit} remaining (${percentUsed.toFixed(1)}% used). Reset at ${status.reset.toISOString()}${cacheIndicator}`,
    );
  }
}

/**
 * Check if we have enough rate limit headroom before expensive operations
 * @param requiredCalls - Estimated number of API calls needed
 * @returns true if we have enough headroom, false otherwise
 */
export async function hasRateLimitHeadroom(
  client: Client,
  requiredCalls: number,
): Promise<boolean> {
  const status = await checkRateLimit(client);
  return status.remaining >= requiredCalls;
}
