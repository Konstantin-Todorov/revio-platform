/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    /**
     * Room photos arrive through a server action, and Next caps action bodies at 1 MB by default.
     * Hotels upload straight off a phone — 2 to 6 MB is normal — so every real upload was rejected
     * at the framework boundary before any of our code ran, surfacing as a generic "this screen
     * didn't load". `sharp` then re-encodes to a fraction of this, so the limit only has to cover
     * what a camera produces, not what we store.
     */
    serverActions: { bodySizeLimit: "40mb" },
  },
  // Workspace TS packages must be transpiled by Next…
  transpilePackages: ["@revio/booking", "@revio/core", "@revio/ui", "@revio/db", "@revio/connectivity"],
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
