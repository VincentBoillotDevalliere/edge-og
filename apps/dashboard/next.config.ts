import type { NextConfig } from "next";

// Make the optional plugin resilient in local dev (fallback to identity)
const withOG: (cfg: NextConfig) => NextConfig = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@edge-og/next-plugin");
    return mod.withOG ?? ((c: NextConfig) => c);
  } catch {
    return (c: NextConfig) => c;
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withOG(nextConfig);
