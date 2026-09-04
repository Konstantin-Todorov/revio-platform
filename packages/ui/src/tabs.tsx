"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tabs whose indicator slides between them.
 *
 * The indicator is positioned from the **live button box** rather than from a percentage: the
 * labels are words of different widths, and they change width again when the webfont swaps in. A
 * percentage-based indicator is correct only until Hanken Grotesk finishes loading, then sits
 * slightly wrong forever — so this measures, on mount, on resize, and once `document.fonts` settles.
 */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [active, tabs]);

  return (
    <div ref={wrap} role="tablist" className="relative flex gap-0.5 border-b border-surface-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          data-tab={t.key}
          role="tab"
          aria-selected={t.key === active}
          onClick={() => onChange(t.key)}
          className={
            "relative px-3 py-2 text-[13px] font-semibold outline-none " +
            "transition-colors duration-fast ease-standard focus-visible:shadow-focus " +
            (t.key === active ? "text-brand-800" : "text-ink-400 hover:text-ink-700")
          }
        >
          {t.label}
        </button>
      ))}
      {box && (
        <span
          aria-hidden="true"
          className="absolute -bottom-px h-0.5 rounded-t bg-brand-800 transition-[transform,width] duration-base ease-standard"
          style={{ width: box.width, transform: `translateX(${box.left}px)` }}
        />
      )}
    </div>
  );
}
