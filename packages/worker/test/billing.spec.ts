import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(128));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';
import { getPlanLimit } from '../src/utils/quota';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('BI-1: Billing Starter upgrade via Stripe', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('webhook invoice.paid sets account plan to starter and raises quota to 2M', async () => {
    // In-memory KV
    const accountsStore = new Map<string, string>();
    const usageStore = new Map<string, string>();

    const accountId = 'acc_billing_1';
    accountsStore.set(`account:${accountId}`, JSON.stringify({ email_hash: 'h', created: new Date().toISOString(), plan: 'free' }));

    const testEnv = {
      ...env,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'jwt-secret-at-least-32-characters-long-xyz',
      ACCOUNTS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = accountsStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          accountsStore.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      USAGE: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = usageStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          usageStore.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    // Simulate Stripe webhook payload
    const payload = {
      type: 'invoice.paid',
      data: { object: { metadata: { account_id: accountId } } }
    };

    const req = new IncomingRequest('https://example.com/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);

    // Verify plan updated
    const updated = JSON.parse(accountsStore.get(`account:${accountId}`) as string);
    expect(updated.plan).toBe('starter');

    // Verify limit helper reflects 2M
    expect(getPlanLimit('starter')).toBe(2_000_000);
  });

  it('checkout endpoint returns a URL in dev/test', async () => {
    const testEnv = { ...env, ENVIRONMENT: 'test', BASE_URL: 'https://edge.test' } as any;

    const req = new IncomingRequest('https://example.com/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'edge_og_session=abc' },
      body: JSON.stringify({}),
    });

    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.url).toContain('/dashboard');
  });

  it('rejects webhook when STRIPE_WEBHOOK_SECRET set and signature invalid', async () => {
    const accountsStore = new Map<string, string>();
    const accountId = 'acc_sig_1';
    accountsStore.set(`account:${accountId}`, JSON.stringify({ email_hash: 'h', created: new Date().toISOString(), plan: 'free' }));

    const testEnv = {
      ...env,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'jwt-secret-at-least-32-characters-long-xyz',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      ACCOUNTS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = accountsStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          accountsStore.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      USAGE: env.USAGE,
    } as any;

    const payload = { type: 'invoice.paid', data: { object: { metadata: { account_id: accountId } } } };
    const body = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000);
    // Intentionally invalid v1
    const sigHeader = `t=${t},v1=deadbeef`;

    const req = new IncomingRequest('https://example.com/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader },
      body,
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(401);
    const updated = JSON.parse(accountsStore.get(`account:${accountId}`) as string);
    expect(updated.plan).toBe('free');
  });

  it('accepts webhook when signature valid and upgrades plan', async () => {
    const accountsStore = new Map<string, string>();
    const accountId = 'acc_sig_2';
    accountsStore.set(`account:${accountId}`, JSON.stringify({ email_hash: 'h', created: new Date().toISOString(), plan: 'free' }));

    const secret = 'whsec_test_secret';
    const testEnv = {
      ...env,
      ENVIRONMENT: 'test',
      JWT_SECRET: 'jwt-secret-at-least-32-characters-long-xyz',
      STRIPE_WEBHOOK_SECRET: secret,
      ACCOUNTS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = accountsStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          accountsStore.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      USAGE: env.USAGE,
    } as any;

    const payload = { type: 'invoice.paid', data: { object: { metadata: { account_id: accountId } } } };
    const body = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000);
    const signedPayload = `${t}.${body}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    const sigHeader = `t=${t},v1=${hex}`;

    const req = new IncomingRequest('https://example.com/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader },
      body,
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const updated = JSON.parse(accountsStore.get(`account:${accountId}`) as string);
    expect(updated.plan).toBe('starter');
  });
});
