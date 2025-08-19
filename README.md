# Edge-OG — Open Graph images at the Edge

[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?logo=typescript&logoColor=white)](./)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![pnpm](https://img.shields.io/badge/pnpm-10%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![API /og](https://img.shields.io/badge/API-/og-0366d6)](#public-api)
[![Cache](https://img.shields.io/badge/Cache-1y%20immutable-2ea44f)](#caching--performance)

Edge-OG is a micro‑SaaS that generates Open Graph images instantly on Cloudflare Workers with near‑zero infra cost and a developer‑first DX.

- 1200×630 PNGs with TTFB p95 < 150 ms (target)
- 1‑year immutable caching with ETag + versioning
- Security‑first: strict param validation, SVG sanitization, HTTPS enforced
- KV‑backed templates, API keys & quotas, structured logs
- SDK, CLI, and Next.js plugin included


## Quick start

Pick your preferred way to use Edge‑OG.

### 1) HTTP API (zero install)

GET /og returns an image. Example:

- Direct URL
  - https://demo.edge-og.workers.dev/og?title=Hello%20World&template=blog&theme=dark
- cURL
  - curl -sSL "https://demo.edge-og.workers.dev/og?title=Hello&template=default" -o og.png

In production, include Authorization: Bearer eog_... (see Auth below).

### 2) JavaScript/TypeScript SDK

- Package: `@edge-og/sdk`
- Usage:
  - `import { generateOG, getImageUrl, EdgeOGClient } from '@edge-og/sdk'`
  - `await generateOG({ title: 'Hello', template: 'blog', theme: 'dark' }, { baseUrl: 'https://demo.edge-og.workers.dev', apiKey: process.env.EDGE_OG_API_KEY })`

See `packages/sdk/README.md` for full examples.

### 3) CLI local preview

- Package: `@edge-og/cli`
- Examples:
  - `edge-og preview --title "Hello" --theme dark`
  - `edge-og preview --title "Docs" --format svg --out preview.svg --no-open`

See `packages/cli/README.md`.

### 4) Next.js plugin

- Package: `@edge-og/next-plugin`
- Wrap your `next.config.ts` with `withOG()` and use OG URLs in your pages/MDX.

See `packages/next-plugin/README.md`.


## Public API

Single endpoint to generate Open Graph images.

- Method: GET
- Path: `/og`
- Auth: `Authorization: Bearer eog_xxx` required in production (see “Auth & Quotas”)
- Response: `image/png` by default, or `image/svg+xml` if requested/fallback
- Caching: `Cache-Control: public, immutable, max-age=31536000` + ETag + optional versioning

### Query parameters

Core params:
- `title`: string (≤ 200 chars)
- `description`: string (≤ 200 chars)
- `template`: one of `default | blog | product | event | quote | minimal | news | tech | podcast | portfolio | course`
- `theme`: one of `light | dark | blue | green | purple`
- `format`: `png | svg` (defaults to png; may fall back to svg where WASM isn’t available)
- `emoji`: string (single emoji supported)

Typography:
- `font`: one of `inter | roboto | playfair | opensans`
- `fontUrl`: HTTPS URL to .ttf/.otf/.woff/.woff2 for custom fonts

Preview & versioning:
- `templateId`: template identifier for previewing records stored in KV (requires session auth)
- `v`: cache‑busting version token. When changed, the cache entry is invalidated (ETag versioning).

Template‑specific fields (optional, used by some templates):
- `author`, `price`, `date`, `location`, `quote`, `role`, `subtitle`, `category`, `version`, `status`, `episode`, `duration`, `name`, `instructor`, `level`

Notes and guards:
- All text params are validated and capped at 200 characters.
- SVG output is sanitized; script/handlers are stripped. PNGs are rasterized via resvg‑wasm.

### Example URLs

- Default template: `/og?title=Hello`  → PNG 1200×630
- Blog, dark theme: `/og?title=Hello&template=blog&theme=dark`
- Custom font: `/og?title=Hello&fontUrl=https%3A%2F%2Fcdn.example.com%2FInter.ttf`
- SVG output: `/og?title=Hello&format=svg`


## Auth & quotas

- API Key: `Authorization: Bearer eog_<kid>_<secret>`
  - Enforced in production by default; local/dev can relax via env flags.
- Quotas:
  - Free plan: strict monthly limit (429 once exceeded).
  - Paid plans: requests continue; overage is recorded daily for billing.


## Caching & performance

- Cache policy: `public, immutable, max-age=31536000`
- ETag: deterministic per normalized params; version‑aware when `v` is present
- Versioning: change `v` to invalidate and refresh a new variant
- Latency budget: request CPU ≤ 10 ms, TTFB p95 < 150 ms (target)
- Fallbacks: when PNG rasterization isn’t available (e.g., local dev without WASM), the worker falls back to SVG and sets `X-Fallback-To-SVG: true`.


## Rendering pipeline

`satori` → SVG → `@resvg/resvg-wasm` → PNG.

- Fonts: loaded by name or HTTPS URL
- Strict sanitization: unsafe SVG constructs are blocked


## Repository layout

- `packages/worker` — Cloudflare Worker (API, rendering, KV, auth, billing)
- `packages/sdk` — JS/TS SDK
- `packages/cli` — Local preview CLI
- `packages/next-plugin` — Next.js integration
- `docs/` — design notes and implementation docs


## Development

Prerequisites:
- Node.js 20+
- pnpm 10+
- Wrangler (Cloudflare Workers CLI)

Install (monorepo):
- `pnpm install`

Run tests:
- `pnpm test`

Dev the Worker locally:
- `pnpm -C packages/worker dev`

Build SDK:
- `pnpm -C packages/sdk build`


## Roadmap & docs

- High‑level roadmap: `ROADMAP.md`
- API and implementation notes: `docs/` (e.g., `EC-1-*`, `EC-2-*`, `CG-*-*`)
- Postman collection: `docs/postman/`


## Security

- Input sanitization: reject params > 200 chars
- HTTPS everywhere; custom fonts must be HTTPS
- Rate limiting and quotas via KV
- Structured logs (JSON) with keys like `event`, `duration_ms`, `status`, `request_id`


## License

ISC — see package metadata. If you intend to reuse substantial parts, consider adding a top‑level LICENSE file.

---

Questions or ideas? Open an issue or start a discussion. Contributions welcome.
