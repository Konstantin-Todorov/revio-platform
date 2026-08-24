"use client";

import { useEffect } from "react";

/**
 * Make the whole of a native date field open its picker, everywhere, forever.
 *
 * `<input type="date">` only opens its calendar from the small indicator glyph at the right-hand
 * edge. Clicking the text — which is most of the control, and the part that looks clickable — does
 * nothing at all. It is the first field in the new-reservation flow, so it is also the platform's
 * first impression, and it recurs in the reservations filter, the bulk-edit modal, the restriction
 * dialogs and the inventory period dialog.
 *
 * ## Why a delegated listener rather than a shared component
 *
 * There are twenty-five of these across three apps. A `<DateField>` component would fix them one at
 * a time and would be forgotten by the twenty-sixth — and "the behaviour is consistent everywhere"
 * is the actual requirement, not "these particular fields behave". One listener on the document
 * covers every date input that exists now, every one added later, and every one inside a dialog that
 * has not been mounted yet.
 *
 * Mount once per app, in the root layout.
 *
 * ## The constraints this respects
 *
 * `showPicker()` must be called from a real user gesture or the browser throws — hence `click`, not
 * `focus`. It also throws on browsers that do not implement it, so the call is guarded and failure is
 * silent: an unsupported browser simply keeps today's behaviour rather than logging on every click.
 * Disabled and read-only fields are left alone, and a click that already landed on the native
 * indicator is skipped so the picker is not asked to open twice.
 */
export function DatePickerAffordance() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const input = target.closest<HTMLInputElement>('input[type="date"], input[type="datetime-local"], input[type="month"]');
      if (!input || input.disabled || input.readOnly) return;

      // The browser is already opening the picker from its own indicator; asking again is noise.
      // The indicator sits in the right ~24px of the control.
      const box = input.getBoundingClientRect();
      if (event.clientX > box.right - 26) return;

      try {
        // Not in every browser's lib.dom yet; the guard is the point.
        (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        // Unsupported, or the browser judged this not to be a user gesture. Either way the field
        // still works exactly as it did before — this is an affordance, never a dependency.
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
