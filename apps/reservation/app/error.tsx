"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusPage, statusPrimaryCls, statusSecondaryCls } from "@revio/ui/status-page";
import { useStaleDeployment } from "@revio/ui/stale-deployment-boundary";
import { reportClientError } from "@revio/ui/report-client-error";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { pages } from "@/lib/i18n/pages";

/**
 * The ROOT error boundary — the gap that let a blank page happen.
 *
 * ⚠️ `global-error.tsx` is not this. It catches a failure of the **root layout** only. Everything
 * else needs a boundary in its own segment, and this app had exactly one, inside `(protected)`. So
 * anything that threw outside that group — `/login`, `/locked`, `/no-access`, or a client-side
 * navigation that fails between route groups — had nothing to catch it and fell through to Next's
 * built-in text: *"Application error: a client-side exception has occurred."* On a white page, with
 * no navigation and nothing to press.
 *
 * Reported from production on 2026-09-14 by the founder, in the words that matter most: *"it looks
 * like the software is broken."* It did, and the reason it looked that way is that at that moment
 * there was nothing on the screen to say otherwise.
 *
 * A **stale tab** is told apart from a fault and never called an outage: every deploy replaces the
 * client bundle, and a tab opened before it asks for chunks the new build no longer serves. The app
 * is fine; this tab is old, and a hard reload is the whole fix — `reset()` would re-render the same
 * stale bundle and fail again, which is why it is not offered in that case.
 */
export default function ReservationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = useStaleDeployment(error);
  const t = translate(pages, useLocale()).status;

  // Filed so we see it, unless it is a stale deployment — recording those would make every release
  // look like an incident.
  useEffect(() => { if (!stale.stale) reportClientError(error, error.digest); }, [error, stale.stale]);

  if (stale.stale) {
    return (
      <StatusPage
        tone="updated"
        title={t.updatedTitle}
        body={t.updatedBody}
      >
        <button onClick={stale.reload} className={statusPrimaryCls}>{t.reload}</button>
      </StatusPage>
    );
  }

  return (
    <StatusPage
      tone="error"
      title={t.pageDidntLoad}
      body={t.errorBody}
      reference={error.digest}
    >
      <button onClick={reset} className={statusPrimaryCls}>{t.tryAgain}</button>
      <Link href="/dashboard" className={statusSecondaryCls}>{t.backToDashboard}</Link>
    </StatusPage>
  );
}
