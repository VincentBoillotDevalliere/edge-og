export {};

import { WorkerError } from './error';
import { log } from './logger';

/**
 * AQ-3.1 Free tier quota enforcement
 * - 1 image per month for free plan by default
 * - Monthly key: usage:{kid}:{YYYYMM}
 * - On first exceed -> HTTP 429 JSON
 *
 * Note: This is a simple KV-based atomic-like increment suitable for tests.
 * In production, move to a Durable Object for true atomicity under high concurrency.
 */

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  key: string;
}

/**
 * Get current UTC year-month like 202508
 */
export function getCurrentYYYYMM(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/**
 * Determine quota limit by plan. For AQ-3.1 we only enforce free:1
 */
export function getPlanLimit(plan: string | undefined): number {
  if (!plan || plan === 'free') return 1;
  if (plan === 'starter') return 1000; // placeholder for AQ-3.3 future
  if (plan === 'pro') return 10000; // placeholder
  return 1;
}

/**
 * Perform a read-modify-write on KV to simulate an increment. Returns the updated count.
 */
async function kvIncrement(env: Env, key: string): Promise<number> {
  const raw = await env.USAGE.get(key, 'json') as { count: number } | null;
  const next = (raw?.count ?? 0) + 1;
  await env.USAGE.put(key, JSON.stringify({ count: next }), {
    metadata: { updated_at: Date.now() },
  });
  return next;
}

/**
 * Check and increment usage for kid and month. Returns whether allowed and current usage.
 */
export async function checkAndIncrementQuota(
  kid: string,
  env: Env,
  requestId?: string,
  plan?: string,
  ip?: string
): Promise<QuotaCheckResult> {
  const yyyymm = getCurrentYYYYMM();
  const key = `usage:${kid}:${yyyymm}`;

  // Determine limit
  const limit = getPlanLimit(plan);

  try {
    const current = await kvIncrement(env, key);
    const allowed = current <= limit;

    if (!allowed) {
      log({ event: 'quota_exceeded', kid, ip, plan: plan || 'free', current, limit, request_id: requestId });
    }

    return { allowed, current, limit, key };
  } catch (error) {
    log({ event: 'quota_check_failed', kid, ip, error: error instanceof Error ? error.message : 'Unknown error', request_id: requestId });
    // On failure, default to allow to avoid accidental outages
    return { allowed: true, current: 0, limit, key };
  }
}
