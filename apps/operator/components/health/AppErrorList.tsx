"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { resolveAppErrorAction } from "@/lib/actions-health";
import { summariseFault } from "@revio/core";

/**
 * Unhandled server errors, one row per distinct fault.
 *
 * The stack is collapsed by default. It is the thing you need second — after deciding whether this
 * fault matters at all — and five expanded traces make the list unreadable, which is how a genuinely
 * important error gets scrolled past.
 */

const SERVICE_LABEL: Record<string, string> = {
  cm: "RevioLink", crs: "RevioCRS", pms: "RevioPMS", operator: "Operator", booking: "RevioDirect",
};

export interface AppErrorItem {
  id: string;
  service: string;
  message: string;
  route: string | null;
  stack: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function AppErrorList({ errors }: { errors: AppErrorItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (errors.length === 0) {
    return (
      <p className="px-4 py-5 text-[13px] text-ink-500">
        No unhandled errors. This counts distinct faults, not requests — so one bug hit a thousand
        times is one row here, and zero means zero.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-surface-border">
      {errors.map((e) => (
        <li key={e.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  {SERVICE_LABEL[e.service] ?? e.service}
                </span>
                {e.count > 1 && (
                  <span className="tnum rounded bg-danger-50 px-1.5 py-0.5 text-[10.5px] font-bold text-danger-600">
                    ×{e.count.toLocaleString("en-GB")}
                  </span>
                )}
                {e.route && <span className="truncate text-[11.5px] text-ink-400">{e.route}</span>}
              </div>
              {/*
                * The HEADLINE is a sentence; the raw exception is behind the disclosure.
                *
                * This line used to print `e.message`, which for a Prisma fault is the entire
                * invocation dump with internal ids and every argument. Support cannot triage a
                * Prisma invocation — they can triage "a rate price was saved with a value that
                * isn't a number, on /calendar". The console's job is to route a fault to a person.
                */}
              <p className="mt-1 break-words text-[13px] font-medium text-ink-900">{summariseFault(e.message, e.route).headline}</p>
              {summariseFault(e.message, e.route).ourBug && (
                <span className="mt-0.5 inline-block rounded bg-danger-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-danger-600">
                  our defect
                </span>
              )}
              <p className="mt-0.5 text-[11px] text-ink-400">
                first {ago(e.firstSeen)} · last {ago(e.lastSeen)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {e.stack && (
                <button
                  type="button"
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                  aria-expanded={open === e.id}
                  className="flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700"
                  aria-label={open === e.id ? "Hide stack trace" : "Show stack trace"}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${open === e.id ? "rotate-180" : ""}`} />
                </button>
              )}
              {/* Resolving is a judgement, not a fix. If the fault happens again it re-opens itself,
                  which is what keeps this a list of live problems rather than old opinions. */}
              <form action={resolveAppErrorAction}>
                <input type="hidden" name="id" value={e.id} />
                <button
                  type="submit"
                  title="Mark resolved — it re-opens automatically if it happens again"
                  className="flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-success-50 hover:text-success-600"
                  aria-label="Mark resolved"
                >
                  <Check className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
          {open === e.id && e.stack && (
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-ink-100">
              {e.stack}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
