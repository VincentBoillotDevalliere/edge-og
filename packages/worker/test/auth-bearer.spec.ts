import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock render to avoid heavy deps
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(256));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';
import { generateAPIKey, storeAPIKey } from '../src/utils/auth';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('AQ-2.3: Authorization Bearer enforcement on /og', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 401 when Authorization is missing (production)', async () => {
    const prodEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'test-secret-at-least-32-characters-123456',
      API_KEYS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    const req = new IncomingRequest('https://example.com/og?title=AuthTest');
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, prodEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const data = await res.json() as any;
    expect(data.error).toContain('Unauthorized');
  });

  it('returns 200 with valid API key (production)', async () => {
    // Prepare a stored key
    const accountId = 'acc_123';
    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'test-secret-at-least-32-characters-abcdef',
      API_KEYS: {
        storage: new Map<string, string>(),
        get: vi.fn().mockImplementation(async function(this: any, key: string, type?: string) {
          const raw = this.storage.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async function(this: any, key: string, value: string) {
          this.storage.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Test Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Test Key', testEnv);

    const req = new IncomingRequest('https://example.com/og?title=AuthOK', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/^image\//);
  });

  it('returns 401 with revoked or invalid key (production)', async () => {
    const accountId = 'acc_456';
    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'another-secret-at-least-32-characters-xyz',
      API_KEYS: {
        storage: new Map<string, string>(),
        get: vi.fn().mockImplementation(async function(this: any, key: string, type?: string) {
          const raw = this.storage.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async function(this: any, key: string, value: string) {
          this.storage.set(key, value);
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    // Create a valid key then mark it revoked in KV
    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Revoked Key', testEnv);
    const record = { account: accountId, hash, name: 'Revoked Key', revoked: true, created: new Date().toISOString() };
    await (testEnv.API_KEYS as any).put(`key:${kid}`, JSON.stringify(record));

    const req = new IncomingRequest('https://example.com/og?title=AuthRevoked', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(401);
  });
});
