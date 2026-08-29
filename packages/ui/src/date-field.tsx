"use client";

import { forwardRef, useCallback } from "react";

/**
 * A native date input that opens when you click it — E2 (§3.3), the global half.
 *
 * `<input type="date">` opens its picker only from the `::-webkit-calendar-picker-indicator`, the
 * small glyph at the right-hand edge. Clicking the field itself does nothing at all, which every
 * user tries first and which reads as a broken control rather than a subtle one.
 *
 * `showPicker()` fixes it in one line, and it must be called from a real user gesture or browsers
 * refuse — so it hangs off `onClick`, not an effect.
 *
 * ## Where this is the right fix and where it is not
 *
 * The **range** picker (`stay-range-field.tsx`) replaced the arrival/departure pair on the
 * availability search, because a stay has two ends that belong on one calendar. This is for every
 * OTHER date field in the platform — a restriction's from/to, a bulk edit window, an out-of-order
 * period — where the dates are independent and a native input is genuinely the right control once
 * it opens properly.
 *
 * Wrapped in try/catch because `showPicker` throws rather than no-ops where it is unsupported, and a
 * date field that throws on click is worse than one that only opens from the glyph.
 */
export type DateFieldProps = React.InputHTMLAttributes<HTMLInputElement>;

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { onClick, ...props },
  ref,
) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(e);
      const el = e.currentTarget;
      if (el.disabled || el.readOnly) return;
      try {
        el.showPicker?.();
      } catch {
        // Unsupported, or the browser declined the gesture. The field still works by typing and by
        // the glyph, which is exactly where we started — so failing quietly is the correct floor.
      }
    },
    [onClick],
  );

  return <input {...props} ref={ref} type="date" onClick={handleClick} />;
});
