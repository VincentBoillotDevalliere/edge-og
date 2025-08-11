# @edge-og/next-plugin

Next.js plugin to auto-generate Open Graph images for MDX pages using Edge-OG.

Usage:

- Install and wrap your Next config

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withOG } from '@edge-og/next-plugin';

const config: NextConfig = {
  // your config
};

export default withOG(config);
```

What it does:
- Ensures MDX RS parsing is enabled when available
- Adds Cache-Control for `/og/*` path (1 year, immutable)
- Exposes `process.env.EDGE_OG_ENDPOINT` if not set

MDX auto-generate idea:
- In your MDX page, you can import the SDK and generate an OG URL at build time, or you can configure your templates to consume `title/description` from frontmatter.

