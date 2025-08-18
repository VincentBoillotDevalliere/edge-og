import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

function makeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn().mockImplementation(async (key: string, type?: string) => {
      const raw = store.get(key) ?? null;
      if (raw && type === 'json') return JSON.parse(raw);
      return raw;
    }),
    put: vi.fn().mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn().mockImplementation(async ({ prefix }: { prefix?: string } = {}) => {
      const keys = Array.from(store.keys())
        .filter(k => (prefix ? k.startsWith(prefix) : true))
        .map(name => ({ name, metadata: null }));
      return { keys } as { keys: Array<{ name: string; metadata?: unknown }> };
    }),
    getWithMetadata: vi.fn().mockImplementation(async (key: string) => {
      const value = store.get(key) ?? null;
      return { value, metadata: null };
    }),
  };
}

describe('DB-2.4: PUT /templates/{id}', () => {
  const fakeToken = 'header.payload.signature';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    const req = new IncomingRequest('https://example.com/templates/tpl-1234567890', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<div/>' }) });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });

  it('returns 415 when content-type is not application/json', async () => {
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({
      account_id: 'acct-1',
      email_hash: 'hash',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      type: 'session',
    } as any);

    const req = new IncomingRequest('https://example.com/templates/tpl-1234567890', { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'text/plain' }, body: 'x' });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(415);
  });

  it('returns 400 on invalid id or body', async () => {
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({ account_id: 'acct-1' } as any);

    // invalid id (too short)
    let req = new IncomingRequest('https://example.com/templates/short', { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<div/>' }) });
    let ctx = createExecutionContext();
    let res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);

    // invalid body (missing source)
    req = new IncomingRequest('https://example.com/templates/tpl-1234567890', { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    ctx = createExecutionContext();
    res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);

    // invalid body (forbidden content)
    req = new IncomingRequest('https://example.com/templates/tpl-1234567890', { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<script>alert(1)</script>' }) });
    ctx = createExecutionContext();
    res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when template not found', async () => {
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({ account_id: 'acct-1' } as any);

    const testEnv = {
      ...env,
      TEMPLATES: makeKV(),
    } as any;

    const req = new IncomingRequest('https://example.com/templates/tpl-abcdef1234', { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<div>ok</div>' }) });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });

  it('returns 403 when template belongs to another account', async () => {
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({ account_id: 'acct-1' } as any);

    const kv = makeKV();
    const id = 'tpl-abcdef1234';
    const record = {
      id,
      account: 'other-account',
      name: 'X',
      slug: 'blog',
      source: '<div/>',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      published: false,
    };
    await (kv as any).put(`template:${id}`, JSON.stringify(record));

    const testEnv = { ...env, TEMPLATES: kv } as any;
    const req = new IncomingRequest(`https://example.com/templates/${id}`, { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<div>new</div>' }) });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(403);
  });

  it('updates template, increments version, and stores revision; keeps only last 5', async () => {
    const authMod = await import('../src/utils/auth');
    vi.spyOn(authMod, 'verifyJWTToken').mockResolvedValue({ account_id: 'acct-1' } as any);

    const kv = makeKV();
    const id = 'tpl-abcdef1234';
    const base = {
      id,
      account: 'acct-1',
      name: 'X',
      slug: 'blog',
      source: '<div/>',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      published: false,
    };
    await (kv as any).put(`template:${id}`, JSON.stringify(base));

    const testEnv = { ...env, TEMPLATES: kv } as any;

    // First update
    let req = new IncomingRequest(`https://example.com/templates/${id}`, { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: '<div>v2</div>' }) });
    let ctx = createExecutionContext();
    let res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    const json1 = await res.json() as any;
    expect(json1.template.version).toBe(2);

    // Ensure revision v1 exists
    const rev1 = await (kv as any).get(`template_rev:${id}:1`, 'json');
    expect(rev1).toBeTruthy();

    // Now perform 5 more updates to trigger cleanup (total revisions: 1..6)
    for (let i = 0; i < 5; i++) {
      req = new IncomingRequest(`https://example.com/templates/${id}`, { method: 'PUT', headers: { 'Cookie': makeSessionCookie(fakeToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ source: `<div>v${i+3}</div>` }) });
      ctx = createExecutionContext();
      res = await worker.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      expect(res.status).toBe(200);
    }

    // After 6 updates total, only last 5 revisions should remain (v2..v6), v1 should be deleted
    const revKeys = ['1','2','3','4','5','6'];
    const present = await Promise.all(revKeys.map(v => (kv as any).get(`template_rev:${id}:${v}`)));
    expect(present[0]).toBeNull(); // v1 deleted
    expect(present.slice(1).every(p => p !== null)).toBe(true); // v2..v6 exist

    // Current version should be 7 (started at 1, +6 updates)
    const current = await (kv as any).get(`template:${id}`, 'json');
    expect(current.version).toBe(7);
  });
});
