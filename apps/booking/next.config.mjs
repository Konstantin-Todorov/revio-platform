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
  // This is the only public, unauthenticated surface on the platform. Nothing here should be
  // framed, sniffed, or leak a referrer to a hotel's OTA competitors.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
      ],
    }];
  },
};

export default nextConfig;
