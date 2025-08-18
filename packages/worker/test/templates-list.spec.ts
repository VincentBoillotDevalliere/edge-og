import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(10));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function makeSessionCookie(token: string) {
  return `edge_og_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

describe('DB-2.1: GET /templates', () => {
  it('returns 401 when unauthenticated', async () => {
    const request = new IncomingRequest('https://example.com/templates');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });

  it('lists templates for the authenticated account only', async () => {
    const fakeToken = 'header.payload.signature';

    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-1',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    const testEnv = {
      ...env,
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      EMAIL_PEPPER: 'test-email-pepper-16chars',
      TEMPLATES: {
        ...env.TEMPLATES,
        list: vi.fn().mockResolvedValue({ keys: [
          { name: 'template:t1' },
          { name: 'template:t2' },
          { name: 'template:other' },
        ] }),
        get: vi.fn().mockImplementation(async (k: string, t?: any) => {
          if (k === 'template:t1') return { account: 'acct-1', name: 'Blog', slug: 'blog', updatedAt: '2025-08-01T10:00:00.000Z', published: true };
          if (k === 'template:t2') return { account: 'acct-1', name: 'Product', slug: 'product', updatedAt: '2025-08-02T10:00:00.000Z', published: false };
          if (k === 'template:other') return { account: 'acct-2', name: 'Other', slug: 'o', updatedAt: '2025-08-03T10:00:00.000Z', published: true };
          return null;
        }),
        put: vi.fn(), delete: vi.fn(), getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null })
      },
    } as any;

    const request = new IncomingRequest('https://example.com/templates', {
      headers: { 'Cookie': makeSessionCookie(fakeToken) }
    });
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const json = await response.json() as any[];
    expect(Array.isArray(json)).toBe(true);
    // Should include only acct-1 items (t1,t2), and sorted by updated desc (t2 first)
    expect(json.length).toBe(2);
    expect(json[0].slug).toBe('product');
    expect(json[1].slug).toBe('blog');
    expect(typeof json[0].published).toBe('boolean');
  });
});
