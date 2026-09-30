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
  experimental: {
    /**
     * Y3's promise — a live screen never shows a stale number — rests on this, so it is stated
     * rather than inherited. 0 is already the Next 15 default for dynamic segments and every screen
     * here is `force-dynamic`, so it changes nothing today; it is written down because depending on
     * a framework default for a correctness property whose failure is INVISIBLE is how a hotel ends
     * up pricing against an occupancy figure that is quietly four minutes old.
     */
    staleTimes: { dynamic: 0 },
  },
  // Workspace TS packages must be transpiled by Next…
  transpilePackages: ["@revio/core", "@revio/ui", "@revio/db", "@revio/connectivity"],
  // …but Prisma's client must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // The workspace packages use NodeNext-style ".js" import specifiers that point at ".ts" sources.
  // Teach webpack to resolve them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
