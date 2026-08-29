/**
 * Response security headers, shared by every app.
 *
 * Plain `.mjs` rather than a workspace TypeScript package on purpose: `next.config.mjs` is loaded by
 * Node before any build step runs, so it cannot import from `@revio/*`. A relative import of a plain
 * ES module is the one thing that works in all five configs without a bundler.
 *
 * ## What is deliberately NOT here
 *
 * **No Content-Security-Policy.** A CSP that is wrong does not degrade, it breaks the page — and
 * Next.js needs specific allowances for its inline bootstrap and streaming. Shipping a guessed one
 * to a live hotel to satisfy a checklist would trade a real outage for a scanner score. It belongs in
 * its own change, with a report-only phase first.
 *
 * **No `preload` on HSTS.** Preloading is submitted to a browser-vendor list and is slow and painful
 * to reverse. Two years of `includeSubDomains` gives the protection; the list can wait until the
 * domains have settled.
 */

/**
 * @param {{ frameAncestors?: "deny" | "sameorigin" }} [opts]
 */
export function securityHeaders(opts = {}) {
  const frame = opts.frameAncestors === "sameorigin" ? "SAMEORIGIN" : "DENY";
  return [
    {
      source: "/:path*",
      headers: [
        // Two years. Railway terminates TLS and every host is already HTTPS-only, so this closes the
        // first-request downgrade window rather than changing what works.
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        // A staff console should never be framed. The booking engine passes "sameorigin" because it
        // is a public page and framing it is a product question, not a security default.
        { key: "X-Frame-Options", value: frame },
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Send the origin cross-site, never the path. A URL here can name a hotel and a reservation.
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=()" },
      ],
    },
  ];
}
