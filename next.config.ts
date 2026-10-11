import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  reactStrictMode: false,
  // exceljs is CommonJS with optional deps; load it from node_modules instead of bundling.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
