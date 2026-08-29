import { securityHeaders } from "../../config/security-headers.mjs";

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
    /**
     * Y3's promise — a live screen never shows a stale number — rests on this, so it is stated
     * rather than inherited.
     *
     * 0 is already the Next 15 default for dynamic segments, and every screen here is
     * `force-dynamic`, so this line changes nothing today. It is written down because the
     * alternative is depending on a framework default for a correctness property whose failure is
     * *invisible*: a occupancy figure that is quietly four minutes old looks exactly like a correct
     * one, and a hotel would price against it.
     *
     * This was measured, not assumed: with the client router cache in this state, renaming a room
     * type behind the app's back and navigating away and back showed the new name immediately.
     */
    staleTimes: { dynamic: 0 },
  },
  // Workspace TS packages must be transpiled by Next…
  transpilePackages: ["@revio/booking", "@revio/core", "@revio/ui", "@revio/db", "@revio/connectivity", "@revio/payments"],
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
