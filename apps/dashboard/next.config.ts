import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default async () => {
  try {
    const moduleName = "@edge-og/next-plugin" as string;
    const importer: (m: string) => Promise<any> = new Function(
      "m",
      "return import(m)"
    ) as any;
    const mod = await importer(moduleName);
    if (typeof mod?.withOG === "function") {
      return mod.withOG(nextConfig as any);
    }
  } catch {
    // No plugin installed; fall back to plain config
  }
  return nextConfig;
};
