"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "@revio/ui/use-scroll-lock";

export function Modal({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Locks the element that ACTUALLY scrolls. This used to set `body.style.overflow` directly, which
  // does nothing here — `<main>` is the scroller in this shell, not `<body>`.
  useScrollLock(open, shell);

  if (!open) return null;
  return (
    <div ref={shell} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-rise overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <h2 className="text-[15px] font-bold tracking-tight text-ink-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>
                {/* `overscroll-contain` is the other half of the scroll lock: without it the wheel
            chains to the page behind the moment this list bottoms out. */}
        <div className="max-h-[70vh] overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-9 w-full rounded-md border border-surface-border bg-white px-3 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";
