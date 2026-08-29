import { securityHeaders } from "../../config/security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace TS packages must be transpiled by Next…
  transpilePackages: ["@revio/booking", "@revio/core", "@revio/ui", "@revio/db", "@revio/connectivity"],
  // …but Prisma's client must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // The workspace packages use NodeNext-style ".js" import specifiers that point at ".ts" sources.
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".jsx": [".tsx", ".jsx"] };
    return config;
  },
  // The only public, unauthenticated surface on the platform — see config/security-headers.mjs.
  // "sameorigin" rather than "deny" because whether a hotel may embed its own booking page is a
  // product decision, and this file should not quietly make it.
  async headers() {
    return securityHeaders({ frameAncestors: "sameorigin" });
  },
};

export default nextConfig;
