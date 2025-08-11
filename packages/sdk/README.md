# @edge-og/sdk

Official SDK for Edge-OG — generate Open Graph images in one line from Node.js or the browser.

## Install

pnpm add @edge-og/sdk

## Quick start

```ts
import { generateOG, getImageUrl, EdgeOGClient } from '@edge-og/sdk';

// One-liner: get PNG bytes
const png = await generateOG({ title: 'Hello', template: 'blog', theme: 'dark' }, {
  baseUrl: 'https://edge-og.dev',
  apiKey: process.env.EDGE_OG_API_KEY,
});

// Or just build the URL
const url = getImageUrl({ title: 'Hello', template: 'blog' }, { baseUrl: 'https://edge-og.dev' });

// Or use a client
const client = new EdgeOGClient({ baseUrl: 'https://edge-og.dev', apiKey: 'eog_...' });
const bytes = await client.generate({ title: 'Hello', description: 'World' });
```

## API
- EdgeOGClient(options)
  - options.baseUrl: string (defaults to https://edge-og.dev)
  - options.apiKey: string | undefined
  - options.fetch: custom fetch implementation
- client.generate(params): Promise<Uint8Array>
- client.imageUrl(params): string
- generateOG(params, options): Promise<Uint8Array>
- getImageUrl(params, options): string

## Notes
- The SDK enforces the 200-byte per-parameter safety check as per project security guidance.
- Responses with non-2xx status throw an Error containing the HTTP status.
