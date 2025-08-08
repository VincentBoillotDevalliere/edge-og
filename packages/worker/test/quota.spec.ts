import { describe, it, expect, vi } from 'vitest';

// Mock render dependencies before any imports like in index.spec.ts
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockImplementation(async () => {
    const fakeImage = new ArrayBuffer(10);
    const view = new Uint8Array(fakeImage);
    view[0] = 137; view[1] = 80; view[2] = 78; view[3] = 71;
    view[4] = 13; view[5] = 10; view[6] = 26; view[7] = 10;
    return fakeImage;
  });
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
  vi.doMock('css-color-keywords', () => ({}));
  vi.doMock('css-to-react-native', () => ({ default: vi.fn() }));
});

// Import helper directly for key format test
import { getUsageKey } from '../src/kv/usage';

// Worker default export for integration test
import worker from '../src/index';
import { env as baseEnv, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('AQ-3.2: Monthly usage key and quota', () => {
  it('builds usage key as usage:{kid}:{YYYYMM} (UTC)', () => {
    const kid = 'abc123';
    const d = new Date(Date.UTC(2025, 0, 15)); // Jan 15, 2025
    expect(getUsageKey(kid, d)).toBe('usage:abc123:202501');
  });

  it('enforces 429 when monthly quota reached', async () => {
    // Prepare environment with mocked API_KEYS and USAGE
    const jwt = 'test-jwt-secret-at-least-32-chars________________________________';
    const kid = 'KID12345';
    const apiKey = `eog_${kid}_SECRETXYZ`;
    const accountId = 'acct-1';

    const env = {
      ...baseEnv,
      REQUIRE_AUTH: 'true',
      JWT_SECRET: jwt,
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          if (key === `key:${kid}`) {
            return type === 'json'
              ? { account: accountId, hash: await import('../src/utils/auth').then(m => m.generateAPIKeyHash(apiKey, jwt)), name: 'Test', revoked: false, created: new Date().toISOString() }
              : JSON.stringify({ account: accountId, hash: await import('../src/utils/auth').then(m => m.generateAPIKeyHash(apiKey, jwt)), name: 'Test', revoked: false, created: new Date().toISOString() });
          }
          return null;
        }),
        put: vi.fn(), list: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn(),
      },
      USAGE: {
        get: vi.fn().mockResolvedValue('1'), // current == limit for free plan (1)
        put: vi.fn(), list: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn(),
      },
    } as any;

    const req = new IncomingRequest('https://example.com/og?template=default', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(429);
    const data = await res.json() as any;
    expect(data.error).toContain('Too many requests');
  });

  it('increments usage when under limit', async () => {
    const jwt = 'test-jwt-secret-at-least-32-chars________________________________';
    const kid = 'KID9';
    const apiKey = `eog_${kid}_SECRET`;
    const accountId = 'acct-2';

    // dynamic hash compute
    const { generateAPIKeyHash } = await import('../src/utils/auth');
    const hash = await generateAPIKeyHash(apiKey, jwt);

    const getSpy = vi.fn().mockResolvedValue('0');
    const putSpy = vi.fn().mockResolvedValue(undefined);

    const env = {
      ...baseEnv,
      REQUIRE_AUTH: 'true',
      JWT_SECRET: jwt,
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          if (key === `key:${kid}`) {
            return type === 'json'
              ? { account: accountId, hash, name: 'Test', revoked: false, created: new Date().toISOString() }
              : JSON.stringify({ account: accountId, hash, name: 'Test', revoked: false, created: new Date().toISOString() });
          }
          return null;
        }),
        put: vi.fn(), list: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn(),
      },
      USAGE: {
        get: getSpy,
        put: putSpy,
        list: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn(),
      },
    } as any;

    const req = new IncomingRequest('https://example.com/og', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    // increment should be scheduled
    expect(putSpy).toHaveBeenCalled();
  });
});
