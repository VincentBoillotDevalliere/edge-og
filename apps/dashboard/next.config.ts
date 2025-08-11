import type { NextConfig } from "next";
import { withOG } from "@edge-og/next-plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withOG(nextConfig);
