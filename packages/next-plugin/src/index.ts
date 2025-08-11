export {};

// Minimal Next.js config-like types to avoid depending on Next's type package at build time
type Header = { key: string; value: string };
type HeaderRoute = { source: string; headers: Header[] };
export type NextConfigLike = {
  headers?: () => Promise<HeaderRoute[]> | HeaderRoute[];
  experimental?: Record<string, unknown>;
  env?: Record<string, string | undefined>;
  // Allow any other Next config fields without typing dependency
  [key: string]: unknown;
};

/**
 * withOG – Wrap Next.js config to auto-generate Open Graph images for MDX routes.
 * - Adds a headers() function to set default OG meta or sitemap headers when rendering static export.
 * - Adds an experimental "mdxRs" or "mdx" support if not present.
 * - Exposes minimal runtime config for the dashboard to discover Edge-OG endpoint.
 */
export function withOG(nextConfig: NextConfigLike = {} as any): NextConfigLike {
  const config: NextConfigLike = { ...nextConfig } as any;

  // Ensure MDX support isn't disabled. We don't force @next/mdx, just enable if present.
  // If user provides their own experimental config, keep it.
  const experimental = (config as any).experimental ?? {};
  if (experimental.mdxRs === undefined) {
    (experimental as any).mdxRs = true;
  }
  (config as any).experimental = experimental;

  // Merge headers: add long-lived cache for OG assets under /og and static exports.
  const userHeaders = (config as any).headers;
  (config as any).headers = async () => {
    const base = typeof userHeaders === 'function' ? await userHeaders() : userHeaders ?? [];
    return [
      ...base,
      {
        source: '/og/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, immutable, max-age=31536000' },
        ],
      },
    ];
  };

  // Expose publicRuntimeConfig-like via env for static export usage, noop for app router mostly.
  const env = (config as any).env ?? {};
  if (env.EDGE_OG_ENDPOINT === undefined) {
    const endpoint = (globalThis as any)?.process?.env?.EDGE_OG_ENDPOINT ?? 'https://api.edge-og.dev/og';
    (env as any).EDGE_OG_ENDPOINT = endpoint;
  }
  (config as any).env = env;

  return config;
}
