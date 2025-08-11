import { describe, it, expect, vi } from 'vitest';
import { withOG } from '../src/index';

describe('withOG', () => {
  it('enables experimental.mdxRs by default and preserves existing config', async () => {
    const cfg = withOG({ compress: false } as any);
    expect((cfg as any).compress).toBe(false);
    expect((cfg as any).experimental?.mdxRs).toBe(true);
  });

  it('does not override existing experimental.mdxRs=false', async () => {
    const cfg = withOG({ experimental: { mdxRs: false } } as any);
    expect((cfg as any).experimental?.mdxRs).toBe(false);
  });

  it('adds Cache-Control header for /og/* and preserves user headers', async () => {
    const cfg = withOG({
      async headers() {
        return [{ source: '/api/:path*', headers: [{ key: 'X-Test', value: '1' }] }];
      },
    } as any);

    const headers = await (cfg as any).headers();
    expect(headers).toEqual([
      { source: '/api/:path*', headers: [{ key: 'X-Test', value: '1' }] },
      { source: '/og/:path*', headers: [{ key: 'Cache-Control', value: 'public, immutable, max-age=31536000' }] },
    ]);
  });

  it('injects default EDGE_OG_ENDPOINT env if not present', () => {
    const prev = process.env.EDGE_OG_ENDPOINT;
    delete process.env.EDGE_OG_ENDPOINT;
    const cfg = withOG({} as any);
    expect((cfg as any).env.EDGE_OG_ENDPOINT).toBeDefined();
    process.env.EDGE_OG_ENDPOINT = prev;
  });
});
