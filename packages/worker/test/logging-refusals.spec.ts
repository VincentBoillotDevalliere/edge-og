import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock render to avoid heavy deps
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(64));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';
import { generateAPIKey, storeAPIKey } from '../src/utils/auth';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('AQ-4.1: Structured logging of auth/quota refusals', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('emits auth_failed log with kid (if prefix present) and ip', async () => {
    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'super-secret-that-is-long-enough-1234567890',
      API_KEYS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    // Fake key format but not stored -> will cause auth failure
    const fakeKey = 'eog_FAKEKID_notreal';
    const req = new IncomingRequest('https://example.com/og?title=AuthLog', {
      headers: {
        Authorization: `Bearer ${fakeKey}`,
        'CF-Connecting-IP': '203.0.113.42',
      },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(401);

    // Find a console.log call with JSON having event: auth_failed
    const calls = logSpy.mock.calls.map(args => String(args[0]));
    const authLogRaw = calls.find(line => line.includes('"event":"auth_failed"'));
    expect(authLogRaw, 'auth_failed log not found').toBeTruthy();
    const authLog = authLogRaw ? JSON.parse(authLogRaw) : {};
    expect(authLog.event).toBe('auth_failed');
    expect(authLog.kid).toBe('FAKEKID');
    expect(authLog.ip).toBe('203.0.113.42');
    expect(authLog.status).toBe(401);
  });

  it('emits quota_exceeded / quota_refused logs with kid and ip', async () => {
    const accountId = 'acc_log_quota_1';

    // In-memory KV stores
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'another-long-enough-jwt-secret-1234567890',
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

    // Free plan for small limit
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'free' }));

    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Quota Log Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Quota Log Key', testEnv);

    // First request to reach the limit
    const firstReq = new IncomingRequest('https://example.com/og?title=First', {
      headers: { Authorization: `Bearer ${fullKey}`, 'CF-Connecting-IP': '198.51.100.7' },
    });
    let ctx = createExecutionContext();
    let res = await worker.fetch(firstReq, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);

    // Second request should exceed and log quota events
    const secondReq = new IncomingRequest('https://example.com/og?title=Second', {
      headers: { Authorization: `Bearer ${fullKey}`, 'CF-Connecting-IP': '198.51.100.7' },
    });
    ctx = createExecutionContext();
    res = await worker.fetch(secondReq, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(429);

    const lines = logSpy.mock.calls.map(args => String(args[0]));
    const quotaExceededRaw = lines.find(l => l.includes('"event":"quota_exceeded"'));
    expect(quotaExceededRaw, 'quota_exceeded log not found').toBeTruthy();
    const quotaExceeded = quotaExceededRaw ? JSON.parse(quotaExceededRaw) : {};
    expect(quotaExceeded.event).toBe('quota_exceeded');
    expect(quotaExceeded.kid).toBe(kid);
    expect(quotaExceeded.ip).toBe('198.51.100.7');

    const quotaRefusedRaw = lines.find(l => l.includes('"event":"quota_refused"'));
    expect(quotaRefusedRaw, 'quota_refused log not found').toBeTruthy();
    const quotaRefused = quotaRefusedRaw ? JSON.parse(quotaRefusedRaw) : {};
    expect(quotaRefused.event).toBe('quota_refused');
    expect(quotaRefused.kid).toBe(kid);
    expect(quotaRefused.ip).toBe('198.51.100.7');
  });
});
