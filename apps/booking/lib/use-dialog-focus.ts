"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where the keyboard goes when a dialog opens and closes (WCAG 2.4.3, 2.1.2).
 *
 * On open, focus moves INTO the dialog — otherwise a keyboard or screen-reader user is still on the
 * button behind it and hears nothing of what just appeared. On close it goes back to whatever opened
 * it, so they do not land at the top of the page and have to find their place again. With `trap`,
 * Tab cycles inside: a modal that lets Tab walk out into the page it is covering is one a sighted
 * keyboard user can lose themselves behind.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, opts: { trap?: boolean } = {}) {
  const trap = opts.trap ?? false;
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current;
    const first = box?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? box)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (!trap || e.key !== "Tab" || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const head = items[0]!;
      const tail = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [active, trap, ref]);
}
