import { isStaleDeploymentError } from "@revio/core";

/**
 * Tell the server that the browser crashed.
 *
 * Until now the error log only saw the SERVER. A component that threw in the browser showed the user
 * an apology and told us nothing: we would learn about it when a hotel telephoned, which is exactly
 * the detection mechanism the error log exists to replace.
 *
 * ## Why only from the error boundary
 *
 * Not a `window.onerror` listener. That fires for every failed third-party script, every extension,
 * every ad blocker mangling a request — noise that would bury the real faults and cost a request
 * each. The error boundary fires when OUR code actually broke a screen somebody was using, which is
 * the population worth storing.
 *
 * ## Why a stale deployment is not reported
 *
 * It is not a fault. The tab was running an older build and the page reloads itself; recording it
 * would file thousands of rows for the product working correctly, and every deploy would look like
 * an incident.
 *
 * Fire-and-forget with `keepalive`, because the page is often about to be reloaded — a normal fetch
 * is cancelled on navigation and the report is lost precisely when it matters.
 */
export function reportClientError(error: unknown, digest?: string): void {
  try {
    if (isStaleDeploymentError(error)) return;

    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    const stack = error instanceof Error ? error.stack : undefined;

    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Trimmed here as well as on the server: no reason to put a megabyte on the wire from a
      // browser that is already having a bad time.
      body: JSON.stringify({
        message: message.slice(0, 500),
        stack: stack?.slice(0, 4000),
        digest,
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      /* a reporter that complains about failing to report is worse than a silent one */
    });
  } catch {
    /* never let reporting an error cause one */
  }
}
