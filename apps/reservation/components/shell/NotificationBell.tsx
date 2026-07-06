"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Item = { text: string; href: string; tone: "danger" | "warning" | "info" | "success" };
const DOT: Record<string, string> = { danger: "bg-danger-500", warning: "bg-warning-500", info: "bg-accent-500", success: "bg-success-500" };

/** Notification bell: a live badge + dropdown of what needs attention (items computed server-side). */
export function NotificationBell({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted">
        <Bell className="h-[18px] w-[18px]" />
        {items.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{items.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <div className="border-b border-surface-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">Needs attention</div>
          {items.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-ink-400">All clear 🎉</div>
          ) : (
            items.map((it, i) => (
              <Link key={i} href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-ink-700 transition-colors hover:bg-surface-muted">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[it.tone]}`} />
                {it.text}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
