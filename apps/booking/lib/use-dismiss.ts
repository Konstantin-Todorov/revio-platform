"use client";

import { useEffect, useRef } from "react";

/**
 * Close-on-outside-click and close-on-Escape for a popover.
 *
 * The returned ref goes on a wrapper containing BOTH the trigger and the panel. Putting it on the
 * panel alone means clicking the trigger to close fires the outside-click handler and the trigger's
 * own toggle in the same gesture, and the panel flickers instead of closing.
 *
 * `pointerdown` rather than `click`: a guest who presses on the page and drags has already decided
 * to leave the panel, and waiting for mouseup leaves it hanging open under their cursor.
 */
export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return ref;
}
