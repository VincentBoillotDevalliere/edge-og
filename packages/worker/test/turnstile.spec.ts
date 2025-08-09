import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

export {};

import { verifyTurnstileToken } from '../src/utils/auth';

describe('AQ-5.1 Turnstile verification', () => {
  const baseEnv = {
    ENVIRONMENT: 'production',
    TURNSTILE_SECRET_KEY: 'test-secret',
  } as any as Env;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips in non-production envs', async () => {
    const env = { ...baseEnv, ENVIRONMENT: 'development' } as any as Env;
    const ok = await verifyTurnstileToken('abc', '203.0.113.1', env, 'req-1');
    expect(ok).toBe(true);
  });

  it('fails when missing secret in production', async () => {
    const env = { ENVIRONMENT: 'production' } as any as Env;
    const ok = await verifyTurnstileToken('token-xyz', '203.0.113.1', env, 'req-2');
    expect(ok).toBe(false);
  });

  it('fails with missing/short token', async () => {
    const ok1 = await verifyTurnstileToken('', '203.0.113.1', baseEnv, 'req-3');
    expect(ok1).toBe(false);
    const ok2 = await verifyTurnstileToken(undefined, '203.0.113.1', baseEnv, 'req-3b');
    expect(ok2).toBe(false);
    const ok3 = await verifyTurnstileToken('short', '203.0.113.1', baseEnv, 'req-3c');
    expect(ok3).toBe(false);
  });

  it('verifies successfully with Turnstile API', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const ok = await verifyTurnstileToken('valid-token-123456', '198.51.100.7', baseEnv, 'req-4');
    expect(ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://challenges.cloudflare.com/turnstile/v0/siteverify', expect.objectContaining({ method: 'POST' }));
  });

  it('fails when Turnstile responds not ok', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('bad', { status: 500 }));
    const ok = await verifyTurnstileToken('valid-token-123456', '198.51.100.7', baseEnv, 'req-5');
    expect(ok).toBe(false);
  });

  it('fails when Turnstile success=false', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }));
    const ok = await verifyTurnstileToken('valid-token-123456', '198.51.100.7', baseEnv, 'req-6');
    expect(ok).toBe(false);
  });

  it('fails when fetch throws', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('network error'));
    const ok = await verifyTurnstileToken('valid-token-123456', '198.51.100.7', baseEnv, 'req-7');
    expect(ok).toBe(false);
  });
});
