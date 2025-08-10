import { RequestContext } from '../types/request';
import { WorkerError } from '../utils/error';
import { log } from '../utils/logger';
import { updateAccountPlan } from '../utils/auth';

/**
 * POST /billing/checkout
 * Creates a Stripe Checkout session for upgrading to Starter.
 * In dev/tests, we don't call Stripe. We return a dummy URL.
 */
export async function handleCreateCheckoutSession(context: RequestContext): Promise<Response> {
  const { request, env, requestId } = context;

  // Only allow POST with JSON
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    throw new WorkerError('Unsupported Media Type', 415, requestId);
  }

  // Require authenticated session cookie (basic check)
  const cookie = request.headers.get('Cookie') || '';
  if (!cookie.includes('edge_og_session=')) {
    throw new WorkerError('Unauthorized', 401, requestId);
  }

  // In production, you would create a Stripe Checkout Session server-side using secret key
  const isProd = (env.ENVIRONMENT || '').toLowerCase() === 'production';
  if (isProd && (env as any).STRIPE_SECRET_KEY == null) {
    throw new WorkerError('Billing not configured', 500, requestId);
  }

  // TODO(ai): Implement real Stripe Checkout creation with Products/Prices.
  // For now, return a simulated checkout URL so the dashboard can redirect.
  const url = (env.BASE_URL || 'https://edge-og.local') + '/dashboard?checkout=started';

  log({ event: 'billing_checkout_created', request_id: requestId });
  return Response.json({ url }, { status: 200 });
}

/**
 * POST /webhooks/stripe
 * Receives Stripe events. On invoice.paid for Starter subscription, set plan=starter.
 * We verify with a shared secret when provided; else accept in tests/dev.
 */
export async function handleStripeWebhook(context: RequestContext): Promise<Response> {
  const { request, env, requestId } = context;

  // Stripe sends JSON; verify signature if possible using raw body
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    throw new WorkerError('Unsupported Media Type', 415, requestId);
  }

  const rawBody = await request.text();

  // Verify Stripe signature when secret is configured (prod)
  const secret = (env as any).STRIPE_WEBHOOK_SECRET as string | undefined;
  if (secret) {
    const sigHeader = request.headers.get('Stripe-Signature') || '';
    const { valid, reason } = await verifyStripeSignature(sigHeader, rawBody, secret);
    if (!valid) {
      log({ event: 'stripe_signature_invalid', reason, request_id: requestId });
      throw new WorkerError('Unauthorized', 401, requestId);
    }
  } else {
    // In dev/test, allow missing signature secret
    log({ event: 'stripe_signature_skipped', env: env.ENVIRONMENT || 'dev', request_id: requestId });
  }

  let body: any = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new WorkerError('Bad Request', 400, requestId);
  }
  if (!body || !body.type) {
    throw new WorkerError('Bad Request', 400, requestId);
  }

  const eventType = body.type as string;
  // In our simplified model, we expect metadata.account_id on the subscription/customer or invoice
  // Try to find account_id in typical places
  const accountId = body.data?.object?.metadata?.account_id
    || body.data?.object?.subscription_details?.metadata?.account_id
    || body.data?.object?.lines?.data?.[0]?.metadata?.account_id
    || body.data?.object?.customer_details?.metadata?.account_id
    || body.account_id;

  if (!accountId || typeof accountId !== 'string') {
    log({ event: 'stripe_webhook_missing_account', type: eventType, request_id: requestId });
    // Accept 200 to avoid retries storm but do nothing
    return Response.json({ received: true }, { status: 200 });
  }

  // Handle the event types relevant to upgrade
  if (eventType === 'invoice.paid' || eventType === 'checkout.session.completed' || eventType === 'customer.subscription.created') {
    // Set plan to starter
    await updateAccountPlan(accountId, 'starter', env);
    log({ event: 'stripe_upgrade_starter', account_id: accountId, request_id: requestId });
  } else {
    log({ event: 'stripe_event_ignored', type: eventType, request_id: requestId });
  }

  return Response.json({ received: true }, { status: 200 });
}

export {};

/**
 * Verify Stripe webhook signature according to Stripe docs.
 * Header format: t=timestamp,v1=signature
 * Payload to sign: `${t}.${rawBody}` with HMAC-SHA256 using the endpoint secret
 */
async function verifyStripeSignature(sigHeader: string, rawBody: string, endpointSecret: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Parse header key=value pairs
    const parts = sigHeader.split(',').map(p => p.trim());
    const timestampPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));
    if (!timestampPart || !v1Part) return { valid: false, reason: 'missing_fields' };

    const t = Number(timestampPart.split('=')[1]);
    const v1 = v1Part.split('=')[1];
    if (!Number.isFinite(t) || !v1) return { valid: false, reason: 'invalid_header' };

    // Optional: reject if timestamp too old (> 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - t) > 300) return { valid: false, reason: 'timestamp_out_of_tolerance' };

    const signedPayload = `${t}.${rawBody}`;
    const expected = await hmacSha256Hex(endpointSecret, signedPayload);
    const ok = constantTimeEqual(v1, expected);
    return { valid: ok, reason: ok ? undefined : 'mismatch' };
  } catch {
    return { valid: false, reason: 'exception' };
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}
