import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('DB-2.2: POST /templates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const request = new IncomingRequest('https://example.com/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A', slug: 'a', source: '<div/>' }) });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
  });

  it('returns 415 when content-type is not application/json', async () => {
    const fakeToken = 'header.payload.signature';

    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-1',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    const request = new IncomingRequest('https://example.com/templates', { method: 'POST', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'text/plain' }, body: 'not-json' });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(415);
  });

  it('validates fields and returns 400 on bad input', async () => {
    const fakeToken = 'header.payload.signature';

    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-1',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    const bads = [
      { name: '', slug: 'ok', source: '<div/>' },
      { name: 'x'.repeat(101), slug: 'ok', source: '<div/>' },
      { name: 'ok', slug: '', source: '<div/>' },
      { name: 'ok', slug: 'UPPER', source: '<div/>' },
      { name: 'ok', slug: 'ok', source: '' },
      { name: 'ok', slug: 'ok', source: '<script>alert(1)</script>' },
    ];

    for (const body of bads) {
      const request = new IncomingRequest('https://example.com/templates', { method: 'POST', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(400);
    }
  });

  it('creates a template and returns 201 with sanitized payload', async () => {
    const fakeToken = 'header.payload.signature';

    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-1',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    // Shim KV
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const testEnv = {
      ...env,
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      EMAIL_PEPPER: 'test-email-pepper-16chars',
      TEMPLATES: {
        ...env.TEMPLATES,
        list: vi.fn().mockResolvedValue({ keys: [] }),
        get: vi.fn().mockResolvedValue(null),
        put: putSpy,
        delete: vi.fn(),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null })
      },
    } as any;

    const body = { name: 'Blog', slug: 'blog', source: '<div class="x">ok</div>' };
    const request = new IncomingRequest('https://example.com/templates', { method: 'POST', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(201);
    const json = await response.json() as any;
    expect(json.template).toBeDefined();
    expect(json.template.id).toBeDefined();
    expect(json.template.slug).toBe('blog');
    expect(json.template.published).toBe(false);
    // Ensure KV was called with a template: key
    const calls = putSpy.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toMatch(/^template:/);
  });
});
