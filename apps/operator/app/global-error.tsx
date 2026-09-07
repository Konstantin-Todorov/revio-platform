"use client";

import { useEffect } from "react";
import { reportClientError } from "@revio/ui/report-client-error";

import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";
import { useStaleDeployment } from "@revio/ui/stale-deployment-boundary";
import "./globals.css";

/**
 * Last-resort boundary: the root layout itself failed, so this replaces the whole document and must
 * bring its own <html>/<body>. Deliberately minimal — no nav, no data, nothing that could also fail.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /*
   * A deploy replaced the bundle this tab is running, so a form it submitted used an action id the
   * new server has never seen. The app is fine; this tab is stale. Saying "temporarily unavailable"
   * here is a false statement about our reliability, and the Reload button below calls `reset()`,
   * which re-renders the same stale bundle and fails again.
   */
  const stale = useStaleDeployment(error);

  // File it, unless it is a stale deployment — that is the product working, and recording it
  // would make every release look like an incident.
  useEffect(() => { reportClientError(error, error.digest); }, [error]);
  if (stale.stale) {
    return (
      <html lang="en">
        <body>
          <main className="min-h-screen bg-surface-muted">
            <StatusPage
              tone="updated"
              title="the Revio operator console was just updated"
              body="This page was open while a new version went out. Reloading picks it up — nothing you entered has been lost."
            >
              <button onClick={stale.reload} className={statusPrimaryCls}>Reload the page</button>
            </StatusPage>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-surface-muted">
          <StatusPage
            tone="error"
            title="Revio Operator is temporarily unavailable"
            body="We hit an unexpected problem loading the app. Nothing you’ve saved is affected. Please try again in a moment."
            reference={error.digest}
          >
            <button onClick={reset} className={statusPrimaryCls}>Reload</button>
          </StatusPage>
        </main>
      </body>
    </html>
  );
}
