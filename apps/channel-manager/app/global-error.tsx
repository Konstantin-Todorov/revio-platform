"use client";

import { StatusPage, statusPrimaryCls } from "@revio/ui/status-page";
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
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-surface-muted">
          <StatusPage
            tone="error"
            title="RevioLink is temporarily unavailable"
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
