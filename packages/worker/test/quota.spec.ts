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
