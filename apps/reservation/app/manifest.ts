import type { MetadataRoute } from "next";

/**
 * Installable on a phone's home screen. Opened from there it runs without the browser's bar, which is
 * why the top bar carries its own "← Back" in that mode (`AppBack` in `@revio/ui/app-chrome`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RevioCRS",
    short_name: "RevioCRS",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#0e1f3a",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
