import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';

// Mock render dependencies before any imports (same as index.spec.ts)
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockImplementation(async () => {
    const buf = new ArrayBuffer(100);
    const view = new Uint8Array(buf);
    view[0] = 137; view[1] = 80; view[2] = 78; view[3] = 71;
    view[4] = 13; view[5] = 10; view[6] = 26; view[7] = 10;
    return buf;
  });

  vi.doMock('../src/render', () => ({
    renderOpenGraphImage: mockRenderOpenGraphImage,
  }));

  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
  vi.doMock('css-color-keywords', () => ({}));
  vi.doMock('css-to-react-native', () => ({ default: vi.fn() }));
});

import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function makeSessionCookie(token: string) {
  return `edge_og_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

describe('DB-1.1: Dashboard usage endpoint', () => {
  it('returns 401 when not authenticated', async () => {
    const request = new IncomingRequest('https://example.com/dashboard/usage');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const json = await response.json() as any;
    expect(json.error).toBeDefined();
  });

  it('returns aggregated usage, limit, and resetAt for authenticated user', async () => {
    // Build a fake session JWT that verifyJWTToken will accept by stubbing
    const fakeToken = 'header.payload.signature';

    // Mock verifyJWTToken to accept our fake token
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-123',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    // Mock ACCOUNTS to return starter plan
    const testEnv = {
      ...env,
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      EMAIL_PEPPER: 'test-email-pepper-16chars',
      ACCOUNTS: {
        ...env.ACCOUNTS,
        get: vi.fn().mockResolvedValue(JSON.stringify({ plan: 'starter' })),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      API_KEYS: {
        ...env.API_KEYS,
        list: vi.fn().mockResolvedValue({
          keys: [
            { name: 'key:KID1', metadata: { account: 'acct-123' } },
            { name: 'key:KID2', metadata: { account: 'acct-123' } },
            { name: 'key:OTHER', metadata: { account: 'other' } },
          ]
        }),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      USAGE: {
        ...env.USAGE,
        get: vi.fn().mockImplementation(async (key: string, type?: any) => {
          if (key === `usage:KID1:${new Date().toISOString().slice(0,7).replace('-', '')}`) return 5;
          if (key === `usage:KID2:${new Date().toISOString().slice(0,7).replace('-', '')}`) return { count: 7 };
          return null;
        }),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    const request = new IncomingRequest('https://example.com/dashboard/usage', {
      headers: { 'Cookie': makeSessionCookie(fakeToken) }
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const json = await response.json() as any;
    expect(json.used).toBe(12); // 5 + 7
    expect(json.limit).toBe(2000000); // starter plan limit
    expect(typeof json.resetAt).toBe('string');
    // resetAt should be first of next month UTC
    const reset = new Date(json.resetAt);
    const now = new Date();
    expect(reset.getUTCDate()).toBe(1);
    const nextMonth = (now.getUTCMonth() + 1) % 12;
    expect(reset.getUTCMonth()).toBe(nextMonth);
  });
});
