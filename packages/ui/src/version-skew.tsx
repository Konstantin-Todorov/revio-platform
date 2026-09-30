"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "./i18n-context";

/**
 * A page opened before a deploy, talking to the server after it.
 *
 * Next gives every server action an id that changes with each build, so a tab left open across a
 * deploy sends ids the new server has never heard of: "Failed to find Server Action … from an older
 * or newer deployment". We deploy several times a day, so a receptionist pressing Save on a screen
 * opened this morning met an error page that looked like a crash — and was, from where they sat.
 *
 * The honest fix is what every app with continuous deploys does: recognise it, and load the new
 * version. Once — a reload that fails the same way within a short window is a real error, and it
 * falls through to the ordinary error screen rather than looping.
 */
const SKEW = /Failed to find Server Action|older or newer deployment|ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i;
const KEY = "revio:skew-reload";
const WINDOW_MS = 20_000;

export function isVersionSkew(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return SKEW.test(msg);
}

/** True when this error is a version skew AND a reload has been started for it. */
export function useReloadOnSkew(error: unknown): boolean {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!isVersionSkew(error)) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY) ?? 0); } catch { /* private mode: reload anyway */ }
    if (Date.now() - last < WINDOW_MS) return; // already tried — let the real error show
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setReloading(true);
    window.location.reload();
  }, [error]);
  return reloading;
}

const WORDS = {
  en: { title: "A new version of Revio is ready", body: "Loading it now — this takes a second." },
  bg: { title: "Има нова версия на Revio", body: "Зареждаме я — отнема секунда." },
} as const;

/**
 * Wrap an error boundary's content: a version skew shows a calm "loading the new version" instead of
 * the error page while the reload happens; anything else renders the boundary as before.
 */
export function SkewGuard({ error, children }: { error: unknown; children: ReactNode }) {
  const reloading = useReloadOnSkew(error);
  return reloading ? <SkewNotice /> : <>{children}</>;
}

/** What shows for the second the reload takes. */
export function SkewNotice() {
  const locale = useLocale();
  const w = WORDS[locale === "bg" ? "bg" : "en"];
  return (
    <div role="status" style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "inherit" }}>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{w.title}</p>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{w.body}</p>
      </div>
    </div>
  );
}
