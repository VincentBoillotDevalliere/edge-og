import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

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

describe('DB-2.3: Preview template by templateId', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 404 when templateId does not exist', async () => {
    const accountId = 'acc_preview_missing';

    const apiKeysStore = new Map<string, string>();
    const templatesStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'preview-test-secret-at-least-32-characters-xyz-123',
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
      TEMPLATES: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = templatesStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          templatesStore.set(key, value);
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

    // Create free plan account record so quota path reads plan
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'free' }));

    const { fullKey, hash, kid } = await generateAPIKey(accountId, 'Preview Missing', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Preview Missing', testEnv);

    const req = new IncomingRequest('https://example.com/og?templateId=doesnotexist&title=Any', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
  });

  it('renders preview (200) when template exists and maps slug to built-in template', async () => {
    const accountId = 'acc_preview_ok';

    const apiKeysStore = new Map<string, string>();
    const templatesStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'preview-test-secret-at-least-32-characters-xyz-123',
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
      TEMPLATES: {
        get: vi.fn().mockImplementation(async (key: string, type?: string) => {
          const raw = templatesStore.get(key) ?? null;
          if (raw && type === 'json') return JSON.parse(raw);
          return raw;
        }),
        put: vi.fn().mockImplementation(async (key: string, value: string) => {
          templatesStore.set(key, value);
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

    const { fullKey, hash, kid } = await generateAPIKey(accountId, 'Preview OK', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Preview OK', testEnv);

    // Persist a template KV record with slug 'blog'
    const templateId = 'tpl-12345abcd';
    const record = {
      id: templateId,
      account: accountId,
      name: 'Blog Template',
      slug: 'blog',
      source: '<div/>',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      published: false,
    };
    await (testEnv.TEMPLATES as any).put(`template:${templateId}`, JSON.stringify(record));

    const req = new IncomingRequest(`https://example.com/og?templateId=${templateId}&title=Preview`, {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    // Cache-Control should be set for 1 year as per EC-1 requirement
    expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
  });
});
