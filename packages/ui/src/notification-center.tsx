"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { groupByDay, relativeTime, type AttentionItem, type NotificationFeed } from "@revio/core";

const DOT: Record<string, string> = {
  danger: "bg-danger-500",
  critical: "bg-danger-500",
  warning: "bg-warning-500",
  info: "bg-accent-500",
  success: "bg-success-500",
};

/** How often the panel asks the server what has happened. */
const POLL_MS = 60_000;

/**
 * The notification centre — one component, four products.
 *
 * ## What replaced what
 *
 * There were **four byte-identical copies** of a `NotificationBell`, one per app, each fed by its
 * own `getNotifications`. Identical today and four things to change tomorrow, which is how the
 * second copy always ends up the one that loses something (`docs/UI-STANDARD.md` rule 3).
 *
 * ## ⚠️ Two shapes in one panel, and the difference is not cosmetic
 *
 * **Needs attention** is what the old bell showed: derived state, recomputed every poll, no read
 * mark. Clean the room and the line disappears. **What happened** is the new half: events with a
 * time, read/unread, and a history that survives being read.
 *
 * Only events carry the unread count. An unread badge on a derived state has no correct behaviour —
 * either it ignores being read, or reading it hides a problem that is still happening.
 *
 * ## Three details that decide whether it is trusted
 *
 * 1. **Opening the panel does not mark anything read.** The familiar shape from GitHub and Linear,
 *    and the reason is that a glance must not destroy the record: a receptionist who opens this
 *    while the phone rings has to still find the thing afterwards. Reading one opens it; there is a
 *    "mark all" for the deliberate version.
 * 2. **It polls, and it never blanks.** New data replaces old in place, so the list does not flash
 *    empty every sixty seconds. A poll that fails leaves what is on screen alone — a stale list is
 *    better than "no notifications" when the truth is "could not ask".
 * 3. **The day headings are the PROPERTY's days.** See `groupByDay` — a booking at 01:30 in Sofia
 *    belongs to today, and UTC calls it yesterday until 03:00, which is the night auditor's shift.
 */
export function NotificationCenter({
  initial,
  timeZone,
  load,
  markRead,
  markAllRead,
  onNavigate,
}: {
  /** Rendered by the server so the first paint is already right — no spinner on a topbar. */
  initial: NotificationFeed;
  /** The property's timezone, for day headings and relative times. */
  timeZone: string;
  /** Re-reads the feed. Runs on the server; returns the same shape. */
  load: () => Promise<NotificationFeed>;
  markRead: (key: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  onNavigate: (href: string) => void;
}) {
  const [feed, setFeed] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  /** Only the newest poll may write. Same reason the palette has one. */
  const gen = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++gen.current;
    try {
      const next = await load();
      // ⚠️ A slower earlier poll must never overwrite a newer one, and a failed poll must leave the
      // screen alone — showing "nothing" when the truth is "could not ask" is the worse lie.
      if (gen.current === mine) setFeed(next);
    } catch {
      /* keep what is on screen */
    }
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Close on an outside click, and on Escape — a panel you cannot dismiss with the keyboard is a
  // trap for the people who never touch the mouse, which at a front desk is most of them.
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  const openItem = (key: string, href: string) => {
    setOpen(false);
    // Optimistic, then persisted. The navigation is what the person asked for and it must not wait
    // on a write whose only job is to stop a dot being drawn.
    setFeed((f) => ({
      ...f,
      events: f.events.map((e) => (e.key === key ? { ...e, read: true } : e)),
      unread: Math.max(0, f.unread - (f.events.find((e) => e.key === key)?.read ? 0 : 1)),
    }));
    void markRead(key);
    onNavigate(href);
  };

  const clearAll = () => {
    startTransition(async () => {
      await markAllRead();
      await refresh();
    });
  };

  const days = groupByDay(feed.events, timeZone);
  const hasAnything = feed.attention.length > 0 || feed.events.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) void refresh(); }}
        aria-label={feed.unread > 0 ? `Notifications — ${feed.unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted"
      >
        <Bell className="h-[18px] w-[18px]" />
        {/* ⚠️ The badge counts UNREAD EVENTS, not attention states. A count that cannot be cleared
            teaches people to stop seeing it, and then the one that matters is invisible too. */}
        {feed.unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {feed.unread > 99 ? "99+" : feed.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <div className="flex items-center justify-between gap-2 border-b border-surface-border px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">Notifications</span>
            {feed.unread > 0 && (
              <button
                type="button"
                onClick={clearAll}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,480px)] overflow-y-auto">
            {/* What is WRONG, first and unmissable — it is the only part somebody has to act on
                today. No read marks here: these clear themselves when the problem is fixed. */}
            {feed.attention.length > 0 && (
              <div className="border-b border-surface-border bg-surface-muted/40">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  Needs attention
                </p>
                {feed.attention.map((it: AttentionItem, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setOpen(false); onNavigate(it.href); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-700 transition-colors hover:bg-white"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[it.tone]}`} />
                    <span className="min-w-0 flex-1 truncate">{it.text}</span>
                  </button>
                ))}
              </div>
            )}

            {days.map((day) => (
              <div key={day.day}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  {day.label}
                </p>
                {day.events.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => openItem(e.key, e.href)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                  >
                    {/* Unread is carried by weight AND a dot, never by colour alone — the shift
                        that reads this at 3am is not looking closely. */}
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.read ? "bg-transparent" : DOT[e.severity]}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className={`block truncate text-[12.5px] ${e.read ? "text-ink-600" : "font-semibold text-ink-900"}`}>
                        {e.title}
                      </span>
                      {e.body && <span className="block truncate text-[11.5px] text-ink-500">{e.body}</span>}
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-ink-400">
                        {relativeTime(e.at, timeZone)}
                        {/* Which property — drawn only when the account holds more than one. */}
                        {e.context && <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-medium text-ink-500">{e.context}</span>}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {!hasAnything && (
              <p className="px-3 py-8 text-center text-[12.5px] text-ink-400">
                Nothing needs you, and nothing has happened since you last looked.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
