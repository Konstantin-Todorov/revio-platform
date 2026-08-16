/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
