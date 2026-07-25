import type { ReactNode } from "react";

/**
 * The full-page "something isn't right" panel — shared by every app's error and not-found
 * boundaries.
 *
 * A hotel hitting an error should never see a stack trace or Next's bare default page. It should
 * see plain language, one obvious way forward, and — for genuine faults — a reference it can quote
 * to us. Nothing here reveals what went wrong internally: the digest is an opaque id, not a message.
 */

export type StatusTone = "error" | "notFound" | "blocked";

const TONE: Record<StatusTone, { chip: string; icon: ReactNode }> = {
  error: {
    chip: "bg-danger-50 text-danger-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  notFound: {
    chip: "bg-brand-50 text-brand-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  blocked: {
    chip: "bg-warning-50 text-warning-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function StatusPage({
  tone = "error",
  title,
  body,
  reference,
  children,
}: {
  tone?: StatusTone;
  title: string;
  body: string;
  /** Next's error digest — an opaque id the hotel can quote to support. Never a message. */
  reference?: string | undefined;
  /** Actions: a retry button, a link home. */
  children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${t.chip}`}>{t.icon}</div>
      <h1 className="text-[19px] font-bold tracking-tight text-ink-900">{title}</h1>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-500">{body}</p>
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{children}</div>}
      {reference && (
        <p className="mt-6 text-[11.5px] text-ink-400">
          Reference <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-ink-500">{reference}</code>
        </p>
      )}
    </div>
  );
}

/** Primary action styling, so every boundary's buttons match without importing app primitives. */
export const statusPrimaryCls =
  "rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700";
export const statusSecondaryCls =
  "rounded-md border border-surface-border bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted";
