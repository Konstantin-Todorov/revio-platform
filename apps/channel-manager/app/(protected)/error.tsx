"use client";

import { SkewNotice, useReloadOnSkew } from "@revio/ui/version-skew";

import Link from "next/link";
import { StatusPage, statusPrimaryCls, statusSecondaryCls } from "@revio/ui/status-page";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { pages } from "@/lib/i18n/pages";

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
  // A tab opened before a deploy: load the new version instead of showing a crash.
  const reloading = useReloadOnSkew(error);
  const t = translate(pages, useLocale()).status;
  if (reloading) return <SkewNotice />;
  return (
    <StatusPage
      tone="error"
      title={t.errorTitle}
      body={t.errorBody}
      reference={error.digest}
    >
      <button onClick={reset} className={statusPrimaryCls}>{t.tryAgain}</button>
      <Link href="/dashboard" className={statusSecondaryCls}>{t.backToDashboard}</Link>
    </StatusPage>
  );
}
