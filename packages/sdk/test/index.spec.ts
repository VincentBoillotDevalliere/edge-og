import { describe, it, expect } from 'vitest';
import { EdgeOGClient, generateOG, getImageUrl } from '../src/index';

function makeFetch(ok: boolean, body: Uint8Array | string, status = 200) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const resInit: ResponseInit = { status };
    if (ok && body instanceof Uint8Array) {
      return new Response(body as any, resInit);
    }
    return new Response(typeof body === 'string' ? body : 'err', resInit);
  };
}

describe('EdgeOGClient', () => {
  it('builds URL with params', () => {
    const c = new EdgeOGClient({ baseUrl: 'https://example.com' });
    const url = c.imageUrl({ title: 'Hello World', template: 'blog', emoji: '🚀' });
    expect(url).toContain('https://example.com/og?');
    expect(url).toContain('title=Hello+World');
    expect(url).toContain('template=blog');
    expect(decodeURIComponent(url)).toContain('emoji=🚀');
  });

  it('enforces 200-byte param limit', () => {
    const c = new EdgeOGClient({ baseUrl: 'https://example.com' });
    const v = 'x'.repeat(201);
    expect(() => c.imageUrl({ title: v })).toThrow(/exceeds 200 bytes/);
  });

  it('succeeds with fetch and returns bytes', async () => {
    const png = new Uint8Array([137,80,78,71,0]);
  const c = new EdgeOGClient({ baseUrl: 'https://example.com', fetch: makeFetch(true, png) as any });
    const res = await c.generate({ title: 'Hi' });
    expect(res).toBeInstanceOf(Uint8Array);
    expect(res.length).toBe(5);
  });

  it('adds Authorization when apiKey provided', async () => {
    let capturedAuth: string | null = null;
    const f = async (_url: string, init?: RequestInit) => {
      capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] ?? null;
      return new Response(new Uint8Array([1]), { status: 200 });
    };
    const c = new EdgeOGClient({ baseUrl: 'https://example.com', apiKey: 'eog_abc', fetch: f as any });
    await c.generate({ title: 'Hi' });
    expect(capturedAuth).toBe('Bearer eog_abc');
  });

  it('throws with status and message on error', async () => {
  const c = new EdgeOGClient({ baseUrl: 'https://example.com', fetch: makeFetch(false, 'Bad', 401) as any });
    let caught: any;
    try {
      await c.generate({ title: 'Hi' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught.message)).toMatch(/401/);
  });
});

describe('one-liners', () => {
  it('generateOG uses client', async () => {
    const png = new Uint8Array([1,2,3]);
  const data = await generateOG({ title: 'T' }, { baseUrl: 'https://example.com', fetch: makeFetch(true, png) as any });
    expect(data.length).toBe(3);
  });

  it('getImageUrl uses client', () => {
    const url = getImageUrl({ title: 'X' }, { baseUrl: 'https://example.com' });
    expect(url).toContain('title=X');
  });
});
