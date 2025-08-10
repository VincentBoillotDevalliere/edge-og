export {};

import { RequestContext } from '../types/request';
import { WorkerError } from '../utils/error';
import { resetMonthlyQuota, getMonthlyUsage } from '../kv/usage';
import { getCurrentYYYYMMDD, isDateReported, listOverageForDate, markDateReported } from '../kv/overage';
import { log } from '../utils/logger';

/**
 * Validate YYYYMM format (e.g., 202501)
 */
function isValidYYYYMM(yyyymm: string): boolean {
  return /^[0-9]{6}$/.test(yyyymm) && (() => {
    const year = Number(yyyymm.slice(0, 4));
    const month = Number(yyyymm.slice(4, 6));
    return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
  })();
}

/**
 * Create a UTC Date at first day of given YYYYMM
 */
function dateFromYYYYMM(yyyymm: string): Date {
  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4, 6));
  // JS months are 0-based
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

/**
 * Constant-time string comparison
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface ResetBody {
  kid?: string;
  yyyymm?: string;
}

/**
 * Admin: Reset monthly usage for a given key ID (kid)
 * Route: POST /admin/usage/reset
 * Auth: Requires header X-Admin-Secret matching env.ADMIN_SECRET
 */
export async function handleAdminUsageReset(context: RequestContext): Promise<Response> {
  const { request, env, requestId } = context;

  // Require admin secret
  const provided = request.headers.get('X-Admin-Secret') || '';
  const expected = (env.ADMIN_SECRET as string) || '';
  if (!expected || !provided || !constantTimeEqual(provided, expected)) {
    throw new WorkerError('Unauthorized', 401, requestId);
  }

  // Enforce JSON body
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    throw new WorkerError('Content-Type must be application/json', 415, requestId);
  }

  let body: ResetBody;
  try {
    body = await request.json();
  } catch {
    throw new WorkerError('Invalid JSON body', 400, requestId);
  }

  const kid = (body.kid || '').trim();
  if (!kid || kid.length > 64) {
    throw new WorkerError('Invalid or missing kid', 400, requestId);
  }

  let date: Date | undefined = undefined;
  if (body.yyyymm !== undefined) {
    if (typeof body.yyyymm !== 'string' || !isValidYYYYMM(body.yyyymm)) {
      throw new WorkerError('Invalid yyyymm format. Expected YYYYMM.', 400, requestId);
    }
    date = dateFromYYYYMM(body.yyyymm);
  }

  // Perform reset
  await resetMonthlyQuota(env, kid, date);
  const usage = await getMonthlyUsage(env, kid, date);

  return new Response(
    JSON.stringify({ success: true, kid, yyyymm: body.yyyymm, usage }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Admin: Report previous day's overage (BI-2 J+1 metered)
 * Route: POST /admin/billing/report-daily
 * Auth: X-Admin-Secret
 * Behavior: Aggregates overage:{account}:{YYYYMMDD} for yesterday, logs totals and marks reported.
 * If STRIPE_METER_PRICE_ID is set, would report usage to Stripe (stubbed with logs here).
 */
export async function handleAdminReportDailyOverage(context: RequestContext): Promise<Response> {
  const { request, env, requestId } = context;

  const provided = request.headers.get('X-Admin-Secret') || '';
  const expected = (env.ADMIN_SECRET as string) || '';
  if (!expected || !provided || !constantTimeEqual(provided, expected)) {
    throw new WorkerError('Unauthorized', 401, requestId);
  }

  // Determine yesterday in UTC
  const now = new Date();
  const yday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yyyymmdd = getCurrentYYYYMMDD(yday);

  // Avoid double-reporting
  if (await isDateReported(env, yyyymmdd)) {
    return new Response(JSON.stringify({ ok: true, already_reported: true, date: yyyymmdd }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  const map = await listOverageForDate(env, yyyymmdd);
  const price = 0.30; // € per 100k

  const lineItems = Object.entries(map).map(([accountId, count]) => {
    const units100k = Math.ceil(count / 100_000);
    const amount = units100k * price;
    return { account_id: accountId, overage: count, units_100k: units100k, amount_eur: amount };
  });

  // Optional: Stripe metered usage integration (stub for now)
  if ((env as any).STRIPE_SECRET_KEY && (env as any).STRIPE_METER_PRICE_ID) {
    log({ event: 'overage_report_stripe_stub', date: yyyymmdd, items: lineItems.length, request_id: requestId });
    // TODO(ai): Implement Stripe usage record creations per subscription item
  }

  // Log a summary for observability
  log({ event: 'overage_report_generated', date: yyyymmdd, accounts: lineItems.length, request_id: requestId });

  await markDateReported(env, yyyymmdd);

  return new Response(JSON.stringify({ ok: true, date: yyyymmdd, items: lineItems }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
