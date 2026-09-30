import { securityHeaders } from "../../config/security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Version-skew protection. With the build's commit as its id, a page from the previous deploy that
   * navigates or loads code after a new one goes out gets a clean reload to the new version instead of
   * mixing old and new files. Server actions are covered by `@revio/ui/version-skew` in the error
   * boundaries — see there for why a stale tab used to look like a crash.
   */
  deploymentId: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
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
