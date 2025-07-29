---
applyTo: '**'
---
<!--
================================================================================
 FILE: AI_CONTRIBUTING.md          (Guidelines for AI‑assisted code generation)
 PROJECT: Edge‑OG – Open Graph Image Generator at the Edge
================================================================================
This file instructs any Large‑Language‑Model (LLM) or other code‑generation
agent how to contribute code **consistently, safely and in line with our
ROADMAP.md**.  
Human reviewers will use this document as the acceptance checklist.
-->

# 📜 Mission Reminder

You are contributing to **Edge‑OG**, a micro‑SaaS that fournit des images
Open Graph instantanées via **Cloudflare Workers**, avec une expérience
_Developer‑First_ et un coût d’infrastructure quasi nul.

All work **MUST** align with the scope, epics, user stories and priorities
defined in [`ROADMAP.md`](./ROADMAP.md).  
If a generated change is outside the current sprint or priority, clearly tag the
Pull Request as **`proposal`** and add a short rationale.

---

## 1.  🎯 Functional Alignment Checklist

| Requirement | How the AI must comply |
|-------------|-----------------------|
| **Language & Runtime** | Write **TypeScript 5+**, ECMAScript modules only, targeting Cloudflare Workers (`--compatibility-date` current ISO date). |
| **Rendering pipeline** | Use `satori` → SVG → `@resvg/resvg-wasm` → PNG exactly; no other rasterisers unless approved. |
| **Latency budget** | Keep *per‑request CPU* ≤ 10 ms and TTFB p95 < 150 ms.<br>Use `ctx.waitUntil()` for async post‑response work. |
| **Edge cache** | Always set `Cache-Control: public, immutable, max-age=31536000` unless the story says otherwise. |
| **KV namespaces** | Access via bindings `TEMPLATES` and `USAGE` only. Prevent un‑scoped reads/writes. |
| **Security** | Validate all query params, escape SVG text, never log secrets, force HTTPS redirects. |
| **Observability** | Emit structured logs (JSON) with keys `event`, `duration_ms`, `status`, `request_id`. |

---

## 2.  🛠️ Coding Standards

1. **Strictness**  
   ```ts
   // In every new file
   export {};          // ensures isolatedModules
   ```


2. Type Safety – tsconfig.json must have:

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true
```

3. Lint / Format

Follow the repo’s shared ESLint & Prettier configs.

No eslint-disable comments unless accompanied by a justification.

4. Error Handling

Throw WorkerError (helper in /utils/error.ts) with an
HTTP statusCode.

Return meaningful messages to crawlers without leaking stack traces.

5. Secrets & Config

Read via env bindings (env.STRIPE_SECRET_KEY), never hard‑code.

6. Modularity

Each file ≤ 300 LOC.

Use pure functions where possible.

No circular imports (eslint-plugin-import/no-cycle).

7 Tests (pnpm test)

Jest 29+, 90 % coverage on new code.

Use Cloudflare‑Worker‑Mocks for request/response objects.

## 3. 🔄 Git & PR Workflow
Step	Rule
Branch naming	feat/{story-id}-{slug} or fix/{bug}
Commit style	Conventional Commits + Story ID in body, e.g.
feat(CG-2): support custom color param
PR template	Fill in ➜ What & Why / Testing / Story reference
CI must pass	pnpm lint && pnpm build && pnpm test
Documentation	Update README or /docs/*.md if API, env vars or CLI change.
Link issues	Close the matching GitHub issue (Closes #12).

## 4. 🌐 File & Folder Layout
```bash
Copy
packages/
├─ worker/            # Cloudflare Worker source
│  ├─ src/
│  │  ├─ index.ts     # entry – keep lean
│  │  ├─ render/      # pure rendering functions
│  │  ├─ kv/          # KV access helpers
│  │  └─ utils/
│  └─ test/
├─ sdk/               # npm package @edge-og/sdk
apps/
└─ dashboard/         # Next.js static export
```
Keep generated code inside these boundaries; do not introduce new top‑level
folders without approval.

## 5. 📈 Performance / Quality Gates
Metric	Hard Fail Threshold
Bundle size (Worker)	dist/index.js ≤ 1 MiB (minified, gzipped)
Unit test coverage	< 85 % fails the PR CI
TTFB p95 (Wrangler dev test)	> 150 ms fails performance job
ESLint errors	0 (warnings allowed but must be explained)

## 6. 🔐 Security Rules of Thumb
Input sanitisation – Reject any param where decoded UTF‑8 > 200 chars.

SVG safety – Strip <script> and event handlers; resvg already
whitelists tags—do not bypass.

Rate limiting – Always look up quota in USAGE KV; block with HTTP 429
on overflow.

## 7. 💬 When Unsure …
Add a comment beginning with // TODO(ai): describing the uncertainty and
open/annotate a GitHub Issue tagged needs-triage.
Human maintainers will clarify and assign priority.

## 8. ✨ Example Prompt for This AI
“Generate TypeScript code for story CG‑2: add support for theme and
emoji query params.
Follow the repo’s ESLint config, keep CPU budget ≤ 10 ms, and write matching
Jest tests.”

