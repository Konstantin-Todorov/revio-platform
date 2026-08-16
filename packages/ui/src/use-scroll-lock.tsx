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
/**
 * How many dialogs currently hold a lock on each element, and what it looked like before the FIRST
 * one took it.
 *
 * Without this the hook corrupts the page the moment two locks overlap, which is not exotic —
 * a confirm dialog opened from inside another dialog, a dialog closing as the next one opens, or
 * React re-running an effect. Each lock saved "the current inline overflow" and restored it on
 * cleanup, so the second one saved `hidden` (put there by the first) and faithfully restored
 * `hidden` when it closed. `<main>` — the ONLY thing that scrolls in this shell — was then stuck
 * unscrollable until a reload, with the page looking frozen and no error anywhere.
 *
 * Found in a founder's browser: `<main>` carrying class `overflow-y-auto` and computed
 * `overflow: hidden`. A WeakMap so a removed element takes its entry with it.
 */
const LOCKS = new WeakMap<HTMLElement, { held: number; overflow: string; top: number }>();

export function useScrollLock(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;

    const targets: HTMLElement[] = [document.body];
    for (let el = ref.current?.parentElement; el; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      // `hidden` counts: an outer dialog may already have locked this very element, and it is still
      // the scroller we mean. Matching only auto/scroll would walk past it to something else.
      const scrolls = overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden";
      if (scrolls && el.scrollHeight > el.clientHeight) {
        targets.push(el);
        break; // The nearest one is the one the wheel would have reached.
      }
    }

    for (const el of targets) {
      const entry = LOCKS.get(el);
      if (entry) {
        entry.held += 1; // Someone already locked it — remember the ORIGINAL, don't re-save `hidden`.
      } else {
        LOCKS.set(el, { held: 1, overflow: el.style.overflow, top: el.scrollTop });
        el.style.overflow = "hidden";
      }
    }

    return () => {
      for (const el of targets) {
        const entry = LOCKS.get(el);
        if (!entry) continue;
        entry.held -= 1;
        if (entry.held > 0) continue; // Another dialog is still open; leave it locked.
        el.style.overflow = entry.overflow;
        el.scrollTop = entry.top;
        LOCKS.delete(el);
      }
    };
  }, [active, ref]);
}
