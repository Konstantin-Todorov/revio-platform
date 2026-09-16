/**
 * Build a same-origin redirect target that survives a reverse proxy.
 *
 * ## The bug this exists to stop happening a third time
 *
 * Behind Railway's proxy, the Node server sees the request as `http://localhost:8080/...`. Next
 * builds both `req.url` and `req.nextUrl` from what the server saw, so **`req.nextUrl.origin` is
 * `http://localhost:8080`, not the public hostname**. Any redirect built with it sends a real
 * browser to a machine that does not exist for them.
 *
 * All four `logout/route.ts` files already carried a comment saying exactly this. The `handoff`
 * routes were written later and used `new URL(path, req.nextUrl.origin)` anyway, which is why
 * switching from RevioLink to RevioPMS landed a hotel on `localhost:3003` — the hand-off itself had
 * worked, the *arrival* redirect was wrong. A lesson written down one directory away is still a
 * lesson nobody reads.
 *
 * ## Why relative rather than "read the forwarded headers"
 *
 * `X-Forwarded-Host` is attacker-controlled unless the proxy is known to overwrite it, and getting
 * that wrong turns every redirect into an open-redirect gadget. A relative `Location` needs no host
 * at all: the browser resolves it against the address bar, which is by definition the public one.
 * RFC 7231 has allowed a relative `Location` since 2014 and every browser has always accepted it.
 *
 * `NextResponse.redirect()` cannot be used with one — it requires an absolute URL — so callers build
 * the response directly:
 *
 * ```ts
 * new NextResponse(null, { status: 307, headers: { Location: relativeLocation("/login", { error: msg }) } })
 * ```
 */
export function relativeLocation(path: string, params?: Record<string, string | undefined>): string {
  // A path that does not start with a single slash is either absolute (another origin) or
  // protocol-relative (`//evil.example` — which a browser reads as a *host*, not a path). Both are
  // open redirects. Callers pass literals today; this refuses the day one of them stops being one.
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`relativeLocation: expected a same-origin path beginning with "/", got ${JSON.stringify(path)}`);
  }

  const entries = Object.entries(params ?? {}).filter(
    (e): e is [string, string] => e[1] !== undefined && e[1] !== "",
  );
  if (entries.length === 0) return path;

  const qs = new URLSearchParams(entries).toString();
  // Keep an existing query string rather than replacing it — a caller that already built one is
  // adding to it, not starting over.
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}
