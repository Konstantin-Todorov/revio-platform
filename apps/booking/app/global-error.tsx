"use client";

import { useStaleDeployment } from "@revio/ui/stale-deployment-boundary";

/**
 * Last resort on the public booking page: the root layout itself failed.
 *
 * Every style this page could inherit comes from that layout, and the hotel's brand tokens are
 * resolved there too — so at this point there is no `--brand`, no font, and no stylesheet worth
 * trusting. Everything below is therefore inline and self-contained, in neutral colours. A hotel's
 * brand rendered half-applied looks more broken than no brand at all.
 *
 * It brings its own <html>/<body> because it replaces the whole document.
 *
 * Same care as `error.tsx`: it does not tell the guest their booking failed (the failure may have
 * come after the reservation was written), and it sends them to the hotel rather than to us —
 * they have a relationship with one and none with the other.
 */
export default function BookingGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /*
   * A deploy replaced the bundle this tab is running, so something it fetched no longer exists. The
   * app is fine; this tab is stale, and a reload is the entire fix.
   *
   * Inline styles like the rest of this file: the layout that would have provided the stylesheet is
   * exactly what failed. Neutral colours, no hotel brand — a brand rendered half-applied looks more
   * broken than no brand at all.
   *
   * The guest gets no apology and no mention of their booking, because nothing has gone wrong with
   * it. `reset()` is deliberately not offered: it re-renders the same stale bundle.
   */
  const stale = useStaleDeployment(error);
  if (stale.stale) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#F4F5F7" }}>
          <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ maxWidth: 420, textAlign: "center" }}>
              <h1 style={{ margin: "0 0 10px", fontSize: 19, fontWeight: 600, color: "#1C2430" }}>
                This page was just updated
              </h1>
              <p style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.6, color: "#5A6473" }}>
                It was open while a new version went out. Reloading picks it up — nothing you entered
                has been lost.
              </p>
              <button
                onClick={stale.reload}
                style={{
                  padding: "11px 22px", fontSize: 14, fontWeight: 600, color: "#fff",
                  background: "#1C2430", border: 0, borderRadius: 8, cursor: "pointer",
                }}
              >
                Reload the page
              </button>
            </div>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f7f9" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            color: "#1c2430",
          }}
        >
          <div style={{ maxWidth: "34rem" }}>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#69737f",
              }}
            >
              Booking
            </p>
            <h1 style={{ margin: "0.75rem 0 0", fontSize: "2rem", lineHeight: 1.2, fontWeight: 600 }}>
              This page isn&rsquo;t loading
            </h1>
            <p style={{ margin: "1rem 0 0", fontSize: "15px", lineHeight: 1.6, color: "#69737f" }}>
              Something went wrong on our side. If you had already confirmed a booking, it is safe —
              check your email for the confirmation. Otherwise please try again shortly, or contact
              the hotel directly.
            </p>

            <button
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                padding: "0.65rem 1.25rem",
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
                background: "#1c2430",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>

            {error.digest && (
              <p style={{ margin: "1.5rem 0 0", fontSize: "12px", color: "#69737f" }}>
                Reference <span style={{ fontWeight: 600 }}>{error.digest}</span>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
