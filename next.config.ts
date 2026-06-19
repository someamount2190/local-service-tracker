import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a wasm/native bundle that must not be bundled by the server compiler.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
