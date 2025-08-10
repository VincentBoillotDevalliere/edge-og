import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock render to avoid heavy deps
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(128));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';
import { generateAPIKey, storeAPIKey } from '../src/utils/auth';
import { getCurrentYYYYMM } from '../src/utils/quota';
import { resetMonthlyQuota, getMonthlyUsage, getUsageKeyForMonth } from '../src/kv/usage';
import { handleAdminUsageReset } from '../src/handlers/admin';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('AQ-3.1: Free tier quota 1 image/month', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows first image and returns 429 on second for same key in same month', async () => {
    const accountId = 'acc_quota_1';

    // In-memory KV stubs
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'quota-test-secret-at-least-32-characters-xyz-123',
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = apiKeysStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          apiKeysStore.set(key, value);
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
    } as any;

    // Create free plan account record
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'free' }));

    // Prepare an API key for that account
    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Quota Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Quota Key', testEnv);

    // First request should pass
    const req1 = new IncomingRequest('https://example.com/og?title=Quota1', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx1 = createExecutionContext();
    const res1 = await worker.fetch(req1, testEnv, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);

    // Second request in same month for same kid should 429
    const req2 = new IncomingRequest('https://example.com/og?title=Quota2', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx2 = createExecutionContext();
    const res2 = await worker.fetch(req2, testEnv, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(429);
    expect(res2.headers.get('Content-Type')).toBe('application/json');
    const data = await res2.json() as any;
    expect(data.error).toContain('Monthly quota exceeded');
    expect(data.limit).toBe(1);
    expect(data.usage).toBeGreaterThan(1);
  });
});

describe('AQ-3.3: Paid plan quotas (limits by plan)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starter plan: allows up to limit and blocks after', async () => {
    const accountId = 'acc_starter_1';

    // In-memory KV stubs
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'quota-test-secret-at-least-32-characters-xyz-123',
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = apiKeysStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          apiKeysStore.set(key, value);
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
    } as any;

    // Create starter plan account record
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'starter' }));

    // Prepare an API key for that account
    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Starter Quota Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Starter Quota Key', testEnv);

  // Pre-seed usage to one below limit (starter=2,000,000 per BI-1)
    const key = `usage:${kid}:${getCurrentYYYYMM()}`;
  usageStore.set(key, JSON.stringify({ count: 1_999_999 }));

  // First request should hit exactly the limit (2,000,000) and be allowed
    const req1 = new IncomingRequest('https://example.com/og?title=Starter1', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx1 = createExecutionContext();
    const res1 = await worker.fetch(req1, testEnv, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(200);

  // Second request should exceed (count=2,000,001) and return 429
    const req2 = new IncomingRequest('https://example.com/og?title=Starter2', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx2 = createExecutionContext();
    const res2 = await worker.fetch(req2, testEnv, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(429);
    const data2 = await res2.json() as any;
  expect(data2.limit).toBe(2_000_000);
  expect(data2.usage).toBeGreaterThan(2_000_000);
  });

  it('pro plan: blocks when usage already at limit', async () => {
    const accountId = 'acc_pro_1';

    // In-memory KV stubs
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'quota-test-secret-at-least-32-characters-xyz-123',
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = apiKeysStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          apiKeysStore.set(key, value);
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
    } as any;

    // Create pro plan account
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'pro' }));

    // Prepare key
    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Pro Quota Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Pro Quota Key', testEnv);

    // Seed usage to the plan limit (pro=10000)
    const key = `usage:${kid}:${getCurrentYYYYMM()}`;
    usageStore.set(key, JSON.stringify({ count: 10000 }));

    // Next request should exceed and 429
    const req = new IncomingRequest('https://example.com/og?title=Pro', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(429);
    const data = await res.json() as any;
    expect(data.limit).toBe(10000);
    expect(data.usage).toBeGreaterThan(10000);
  });
});

describe('AQ-3.4: Admin resets a monthly quota', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resets usage to zero and allows next request', async () => {
    const accountId = 'acc_reset_1';

    // In-memory KV stubs
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'quota-test-secret-at-least-32-characters-xyz-123',
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = apiKeysStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          apiKeysStore.set(key, value);
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
    } as any;

    // Free plan account for easier small limit
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'free' }));

    // Prepare a key
    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Reset Quota Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Reset Quota Key', testEnv);

    // Pre-seed as exceeded (count=2, limit=1 for free)
    const usageKey = getUsageKeyForMonth(kid);
    usageStore.set(usageKey, JSON.stringify({ count: 2 }));

    // Request should be blocked initially
    const blockedReq = new IncomingRequest('https://example.com/og?title=Blocked', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const blockedCtx = createExecutionContext();
    const blockedRes = await worker.fetch(blockedReq, testEnv, blockedCtx);
    await waitOnExecutionContext(blockedCtx);
    expect(blockedRes.status).toBe(429);

    // Admin resets usage
    await resetMonthlyQuota(testEnv as any, kid);
    const afterReset = await getMonthlyUsage(testEnv as any, kid);
    expect(afterReset).toBe(0);

    // Next request should pass
    const okReq = new IncomingRequest('https://example.com/og?title=AfterReset', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const okCtx = createExecutionContext();
    const okRes = await worker.fetch(okReq, testEnv, okCtx);
    await waitOnExecutionContext(okCtx);
    expect(okRes.status).toBe(200);
  });

  it('REST: POST /admin/usage/reset resets usage when authorized', async () => {
    const accountId = 'acc_admin_reset_1';

    // In-memory KV stubs
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'quota-test-secret-at-least-32-characters-xyz-123',
      ADMIN_SECRET: 'topsecret',
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = apiKeysStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          apiKeysStore.set(key, value);
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
    } as any;

    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'free' }));
    const { kid } = await generateAPIKey(accountId, 'Admin Reset', testEnv);
    await storeAPIKey(kid, accountId, 'hash-not-used', 'Admin Reset', testEnv);

    // Seed usage to 5
    const usageKey = getUsageKeyForMonth(kid);
    usageStore.set(usageKey, JSON.stringify({ count: 5 }));

    const req = new IncomingRequest('https://example.com/admin/usage/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'topsecret' },
      body: JSON.stringify({ kid })
    });
    const ctx = createExecutionContext();
    const res = await handleAdminUsageReset({ request: req, env: testEnv, ctx, requestId: 'req-1', startTime: Date.now(), url: new URL(req.url) });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.kid).toBe(kid);
    expect(data.usage).toBe(0);
  });

  it('REST: unauthorized without correct admin secret', async () => {
    const testEnv = { ...env, ADMIN_SECRET: 'topsecret' } as any;
    const req = new IncomingRequest('https://example.com/admin/usage/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'wrong' },
      body: JSON.stringify({ kid: 'abc' })
    });
    await expect(handleAdminUsageReset({ request: req, env: testEnv, ctx: createExecutionContext(), requestId: 'req-2', startTime: Date.now(), url: new URL(req.url) }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('REST: validation error for bad content-type and payload', async () => {
    const testEnv = { ...env, ADMIN_SECRET: 'topsecret' } as any;
    const reqCT = new IncomingRequest('https://example.com/admin/usage/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-Admin-Secret': 'topsecret' },
      body: 'kid=abc'
    });
    await expect(handleAdminUsageReset({ request: reqCT, env: testEnv, ctx: createExecutionContext(), requestId: 'req-3', startTime: Date.now(), url: new URL(reqCT.url) }))
      .rejects.toMatchObject({ statusCode: 415 });

    const reqBad = new IncomingRequest('https://example.com/admin/usage/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'topsecret' },
      body: JSON.stringify({ kid: '' })
    });
    await expect(handleAdminUsageReset({ request: reqBad, env: testEnv, ctx: createExecutionContext(), requestId: 'req-4', startTime: Date.now(), url: new URL(reqBad.url) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
