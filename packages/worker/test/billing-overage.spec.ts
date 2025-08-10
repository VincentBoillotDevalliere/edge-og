import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Light render mocks to keep tests fast
vi.hoisted(() => {
  const mockRenderOpenGraphImage = vi.fn().mockResolvedValue(new ArrayBuffer(16));
  vi.doMock('../src/render', () => ({ renderOpenGraphImage: mockRenderOpenGraphImage }));
  vi.doMock('satori', () => ({ default: vi.fn() }));
  vi.doMock('@resvg/resvg-wasm', () => ({ Resvg: vi.fn(), initWasm: vi.fn() }));
});

import worker from '../src/index';
import { generateAPIKey, storeAPIKey, generateAPIKeyHash } from '../src/utils/auth';
import { getOverageKeyForDay } from '../src/kv/overage';
import { handleAdminReportDailyOverage } from '../src/handlers/admin';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Cloudflare test environment is already configured by vitest config

describe('BI-2: Pay-as-you-go overage tracking and J+1 reporting', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('records overage for paid plan and does not block request', async () => {
    const accountId = 'acc_bi2_paid_1';
    const apiKeysStore = new Map<string, string>();
    const usageStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'test-secret-32-characters-minimum-xxxx',
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
        list: vi.fn().mockImplementation(async ({ prefix }: { prefix?: string }) => {
          const keys = Array.from(usageStore.keys())
            .filter(k => !prefix || k.startsWith(prefix))
            .map(name => ({ name }));
          return { keys } as any;
        }),
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

    // Starter plan account
    await (testEnv.ACCOUNTS as any).put(`account:${accountId}`, JSON.stringify({ plan: 'starter' }));

    const { kid, fullKey, hash } = await generateAPIKey(accountId, 'Paid Key', testEnv);
    await storeAPIKey(kid, accountId, hash, 'Paid Key', testEnv);

    // Seed usage to the limit for starter so next request is overage
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    usageStore.set(`usage:${kid}:${yyyymm}`, JSON.stringify({ count: 2_000_000 }));

    // Make a request that exceeds
    const req = new IncomingRequest('https://example.com/og?title=Paid', {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200); // not blocked

    // Ensure an overage counter was incremented for this account for today
    const todayKey = getOverageKeyForDay(accountId);
    const overageRecord = JSON.parse(usageStore.get(todayKey) || '{"count":0}') as { count: number };
    expect(overageRecord.count).toBeGreaterThanOrEqual(1);
  });

  it('reports previous day overage and marks the day as reported', async () => {
    const accountId = 'acc_bi2_paid_2';
    const usageStore = new Map<string, string>();
    const apiKeysStore = new Map<string, string>();
    const accountsStore = new Map<string, string>();

    const testEnv = {
      ...env,
      ADMIN_SECRET: 'topsecret',
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
        list: vi.fn().mockImplementation(async ({ prefix }: { prefix?: string }) => {
          const keys = Array.from(usageStore.keys())
            .filter(k => !prefix || k.startsWith(prefix))
            .map(name => ({ name }));
          return { keys } as any;
        }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      API_KEYS: {
        get: vi.fn().mockImplementation(async (key: string) => apiKeysStore.get(key) ?? null),
        put: vi.fn().mockImplementation(async (key: string, value: string) => apiKeysStore.set(key, value)),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
      ACCOUNTS: {
        get: vi.fn().mockImplementation(async (key: string) => accountsStore.get(key) ?? null),
        put: vi.fn().mockImplementation(async (key: string, value: string) => accountsStore.set(key, value)),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] }),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
      },
    } as any;

    // Seed yesterday overage
    const now = new Date();
    const yday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const y = yday.getUTCFullYear();
    const m = String(yday.getUTCMonth() + 1).padStart(2, '0');
    const d = String(yday.getUTCDate()).padStart(2, '0');
    const yyyymmdd = `${y}${m}${d}`;
    usageStore.set(`overage:${accountId}:${yyyymmdd}`, JSON.stringify({ count: 123, yyyymmdd, updated_at: Date.now() }));

    const req = new IncomingRequest('https://example.com/admin/billing/report-daily', {
      method: 'POST',
      headers: { 'X-Admin-Secret': 'topsecret' }
    });
    const res = await handleAdminReportDailyOverage({ request: req, env: testEnv, ctx: createExecutionContext(), requestId: 'rep-1', startTime: Date.now(), url: new URL(req.url) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.ok).toBe(true);
    expect(json.date).toBe(yyyymmdd);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items[0].overage).toBe(123);

    // Marked as reported
    expect(usageStore.get(`overage:reported:${yyyymmdd}`)).toBe('true');

    // Second call should be already_reported
    const res2 = await handleAdminReportDailyOverage({ request: req, env: testEnv, ctx: createExecutionContext(), requestId: 'rep-2', startTime: Date.now(), url: new URL(req.url) });
    const json2 = await res2.json() as any;
    expect(json2.already_reported).toBe(true);
  });
});
