"use client";

import { useEffect, type RefObject } from "react";

/**
 * Freeze whatever is behind an open dialog.
 *
 * The obvious one-liner — `document.body.style.overflow = "hidden"` — is a **no-op in three of our
 * four staff apps**, and was for a long time. Their shell is a full-height flex column whose scroll
 * happens on `<main>`; `<body>` is exactly the viewport height and has never scrolled, so locking it
 * locks nothing. Nobody noticed until a dialog got long enough to scroll: you'd scroll to the bottom
 * of it, the wheel would chain through to the page underneath, and closing the dialog would drop you
 * hundreds of pixels down a page whose last section hadn't rendered yet. It reads as "the layout
 * broke", which is why it took a screenshot to diagnose rather than a stack trace.
 *
 * So this walks up from the dialog to find the element that *actually* scrolls and locks that, and
 * keeps locking `<body>` too — that one is the real scroller in the booking engine, which has no
 * app shell.
 *
 * `overflow: hidden` is paired with saving and restoring `scrollTop`: some browsers clamp the offset
 * of a newly-unscrollable element, and a dialog that silently scrolls the page behind it is the bug
 * this function exists to stop.
 *
 * The other half of the fix is CSS and lives at the call site: the dialog's own scrolling area needs
 * `overscroll-behavior: contain`, or the wheel still chains once it bottoms out.
 */
export function useScrollLock(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;

    const targets: HTMLElement[] = [document.body];
    for (let el = ref.current?.parentElement; el; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        targets.push(el);
        break; // The nearest one is the one the wheel would have reached.
      }
    }

    const restore = targets.map((el) => ({ el, overflow: el.style.overflow, top: el.scrollTop }));
    for (const el of targets) el.style.overflow = "hidden";

    return () => {
      for (const { el, overflow, top } of restore) {
        el.style.overflow = overflow;
        el.scrollTop = top;
      }
    };
  }, [active, ref]);
}
