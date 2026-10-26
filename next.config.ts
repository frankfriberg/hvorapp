import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Loaded from node_modules at runtime rather than bundled: PGlite ships a
  // WASM Postgres the bundler can't follow.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
