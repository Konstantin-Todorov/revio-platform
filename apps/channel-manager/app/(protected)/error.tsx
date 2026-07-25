"use client";

import Link from "next/link";
import { StatusPage, statusPrimaryCls, statusSecondaryCls } from "@revio/ui/status-page";

/**
 * In-shell error boundary. The nav stays visible, so a failed screen never looks like the whole
 * product fell over — the hotel can retry or walk to another screen.
 *
 * `reset()` re-renders the segment: for a transient database hiccup that is genuinely all it takes.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      tone="error"
      title="This screen didn’t load"
      body="Something went wrong on our side. Your data is safe — nothing was changed. Try again, and if it keeps happening send us the reference below."
      reference={error.digest}
    >
      <button onClick={reset} className={statusPrimaryCls}>Try again</button>
      <Link href="/dashboard" className={statusSecondaryCls}>Back to Dashboard</Link>
    </StatusPage>
  );
}
