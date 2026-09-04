"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A dropdown menu.
 *
 * Client, because it is the one control here that genuinely holds state. It scales from its own
 * corner and **leaves faster than it arrives** (195ms out against 225ms in): by the time something
 * is closing, the user has already decided and is waiting on us, so a symmetrical exit reads as lag.
 *
 * Keyboard behaviour is the reason this is a component rather than a pattern people re-type:
 * Escape closes and returns focus to the trigger, Arrow keys move through items, and a click
 * anywhere else dismisses. Getting that wrong is invisible until someone tries to use the product
 * without a mouse.
 */
export function Menu({
  trigger,
  children,
  align = "left",
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": true }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger — otherwise Escape leaves focus nowhere and the next Tab
        // restarts from the top of the document.
        wrap.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative inline-block">
      {trigger({ onClick: () => setOpen((v) => !v), "aria-expanded": open, "aria-haspopup": true })}
      <div
        id={id}
        role="menu"
        className={
          `absolute z-40 mt-1.5 min-w-[200px] rounded-xl bg-white p-1.5 shadow-overlay ` +
          (align === "right" ? "right-0 origin-top-right " : "left-0 origin-top-left ") +
          (open
            ? "pointer-events-auto scale-100 opacity-100 duration-enter ease-out"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0 duration-exit ease-in") +
          " transition-[opacity,transform]"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  tone = "neutral",
}: {
  onClick?: () => void;
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-tone={tone === "danger" ? "danger" : undefined}
      className={
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none " +
        // padding-left is in the transition so the item nudges rather than only tinting.
        "transition-colors duration-fast ease-standard hover:pl-3.5 focus-visible:shadow-focus " +
        (tone === "danger" ? "text-danger-600 hover:bg-danger-50" : "text-ink-700 hover:bg-accent-50 hover:text-ink-900")
      }
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-surface-border" role="separator" />;
}
