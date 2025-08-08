export {};

import { log } from '../utils/logger';

/**
 * AQ-3.2: Monthly usage counter key helper
 * Format: usage:{kid}:{YYYYMM} using UTC year-month
 */
export function getUsageKey(kid: string, at: Date = new Date()): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `usage:${kid}:${year}${month}`;
}

/**
 * Get current monthly usage for a given API key id (kid).
 */
export async function getMonthlyUsage(kid: string, env: Env, at: Date = new Date()): Promise<number> {
  try {
    const key = getUsageKey(kid, at);
    const raw = await env.USAGE.get(key);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment current monthly usage for a given API key id (kid).
 * Note: KV increments are not atomic; a Durable Object should be used for strict correctness (see ROADMAP AQ-3).
 */
export async function incrementMonthlyUsage(kid: string, env: Env, at: Date = new Date(), delta = 1): Promise<void> {
  const key = getUsageKey(kid, at);
  try {
    const currentRaw = await env.USAGE.get(key);
    const current = currentRaw ? parseInt(currentRaw, 10) || 0 : 0;
    const next = current + delta;
    await env.USAGE.put(key, String(next));
    log({ event: 'usage_incremented', kid, key, new_value: next });
  } catch (error) {
    // Log but never block the request path
    log({ event: 'usage_increment_failed', kid, key, error: error instanceof Error ? error.message : 'unknown' });
    // TODO(ai): Move to Durable Object QuotaCounter for atomic increments and periodic flushes
  }
}
