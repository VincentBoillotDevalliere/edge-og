export {};

import { getCurrentYYYYMM } from '../utils/quota';

/**
 * Utilities for USAGE KV interactions
 * Supports AQ-3.2 (monthly key) and AQ-3.4 (admin reset)
 */

/**
 * Build the monthly usage KV key for a kid, e.g. usage:{kid}:202508
 */
export function getUsageKeyForMonth(kid: string, date: Date = new Date()): string {
	const yyyymm = getCurrentYYYYMM(date);
	return `usage:${kid}:${yyyymm}`;
}

/**
 * Get current monthly usage count for a key id.
 */
export async function getMonthlyUsage(env: Env, kid: string, date: Date = new Date()): Promise<number> {
	const key = getUsageKeyForMonth(kid, date);
	const raw = await env.USAGE.get(key, 'json') as { count?: number } | number | null;
	if (raw == null) return 0;
	if (typeof raw === 'number') return raw; // supports plain numeric resets
	return raw.count ?? 0;
}

/**
 * Set current monthly usage count explicitly.
 */
export async function setMonthlyUsage(env: Env, kid: string, count: number, date: Date = new Date()): Promise<void> {
	const key = getUsageKeyForMonth(kid, date);
	await env.USAGE.put(key, JSON.stringify({ count }), {
		metadata: { updated_at: Date.now(), source: 'setMonthlyUsage' },
	});
}

/**
 * Reset monthly quota to zero for the given key id (AQ-3.4).
 * Idempotent and safe if the key didn’t exist.
 */
export async function resetMonthlyQuota(env: Env, kid: string, date: Date = new Date()): Promise<void> {
	const key = getUsageKeyForMonth(kid, date);
	await env.USAGE.put(key, JSON.stringify({ count: 0 }), {
		metadata: { updated_at: Date.now(), reset: true },
	});
}
