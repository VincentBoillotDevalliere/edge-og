export {};

import { log } from '../utils/logger';

/**
 * BI-2: Pay-as-you-go overage KV helpers
 * Keys are stored per account and day: overage:{accountId}:{YYYYMMDD}
 */

export interface DailyOverageRecord {
  count: number; // number of images over plan on that day
  yyyymmdd: string;
  updated_at: number;
}

/** Get current UTC YYYYMMDD */
export function getCurrentYYYYMMDD(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function getOverageKeyForDay(accountId: string, date: Date = new Date()): string {
  const yyyymmdd = getCurrentYYYYMMDD(date);
  return `overage:${accountId}:${yyyymmdd}`;
}

/**
 * Increment daily overage counter for an account by delta (default 1).
 * Safe for dev tests (last write wins). In prod, consider Durable Object for atomicity.
 */
export async function incrementDailyOverage(env: Env, accountId: string, delta = 1, date: Date = new Date()): Promise<number> {
  const key = getOverageKeyForDay(accountId, date);
  const raw = (await env.USAGE.get(key, 'json')) as DailyOverageRecord | null;
  const next: DailyOverageRecord = {
    count: (raw?.count ?? 0) + delta,
    yyyymmdd: getCurrentYYYYMMDD(date),
    updated_at: Date.now(),
  };
  await env.USAGE.put(key, JSON.stringify(next), {
    metadata: { updated_at: next.updated_at, type: 'overage' },
  });
  return next.count;
}

export async function getDailyOverage(env: Env, accountId: string, date: Date): Promise<number> {
  const key = getOverageKeyForDay(accountId, date);
  const raw = (await env.USAGE.get(key, 'json')) as DailyOverageRecord | null;
  return raw?.count ?? 0;
}

/**
 * List all overage keys for a specific date (YYYYMMDD), returns map accountId -> count
 */
export async function listOverageForDate(env: Env, yyyymmdd: string): Promise<Record<string, number>> {
  const prefix = `overage:`; // we'll filter by suffix matching :YYYYMMDD
  const result: Record<string, number> = {};
  const { keys } = await env.USAGE.list({ prefix });
  for (const k of keys) {
    if (!k.name.endsWith(`:${yyyymmdd}`)) continue;
    const parts = k.name.split(':'); // ['overage', accountId, yyyymmdd]
    if (parts.length !== 3) continue;
    const accountId = parts[1];
    const rec = (await env.USAGE.get(k.name, 'json')) as DailyOverageRecord | null;
    result[accountId] = (rec?.count ?? 0);
  }
  return result;
}

/**
 * Mark a date as reported to avoid double-billing. Key: overage:reported:{YYYYMMDD}
 */
export async function markDateReported(env: Env, yyyymmdd: string): Promise<void> {
  await env.USAGE.put(`overage:reported:${yyyymmdd}`, 'true', {
    metadata: { reported_at: Date.now() },
  });
}

export async function isDateReported(env: Env, yyyymmdd: string): Promise<boolean> {
  const val = await env.USAGE.get(`overage:reported:${yyyymmdd}`);
  return val === 'true';
}
