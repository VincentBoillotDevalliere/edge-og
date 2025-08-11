export {};

export type OGParams = {
  template?: string;
  title?: string;
  description?: string;
  theme?: string;
  font?: string;
  emoji?: string;
  [k: string]: string | undefined;
};

export type ClientOptions = {
  baseUrl?: string; // Base of the Edge-OG worker, default https://edge-og.dev or provided
  apiKey?: string;  // Optional Bearer token (eog_...)
  fetch?: typeof globalThis.fetch; // Override for tests/environments
};

export class EdgeOGClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private _fetch: typeof globalThis.fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl || '').replace(/\/$/, '') || 'https://edge-og.dev';
  this.apiKey = opts.apiKey;
    this._fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // Contract:
  // input: params for /og endpoint
  // output: Uint8Array PNG bytes
  // error: throws Error with message and status when non-2xx
  async generate(params: OGParams): Promise<Uint8Array> {
    const url = this.buildUrl('/og', params);
    const headers: Record<string, string> = { 'Accept': 'image/png' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await this._fetch(url, { headers });
    if (!res.ok) {
      const text = await safeText(res);
      const err = new Error(`Edge-OG error ${res.status}: ${truncate(text, 200)}`);
      // @ts-expect-error add status for convenience
      err.status = res.status;
      throw err;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf;
  }

  imageUrl(params: OGParams): string {
    return this.buildUrl('/og', params);
  }

  private buildUrl(path: string, params: Record<string, string | undefined>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      // enforce 200 char rule from instructions
      if (new TextEncoder().encode(v).length > 200) {
        throw new Error(`Parameter ${k} exceeds 200 bytes when UTF-8 encoded`);
      }
      usp.set(k, v);
    }
    return `${this.baseUrl}${path}?${usp.toString()}`;
  }
}

// Convenience one-liners
export async function generateOG(params: OGParams, options?: ClientOptions): Promise<Uint8Array> {
  const client = new EdgeOGClient(options);
  return client.generate(params);
}

export function getImageUrl(params: OGParams, options?: ClientOptions): string {
  const client = new EdgeOGClient(options);
  return client.imageUrl(params);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
