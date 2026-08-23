"use client";

import { useRef } from "react";

/**
 * A one-time-code field that submits itself when the code is complete.
 *
 * Typing the last digit and then reaching for a button is a step nobody wants: the code is already
 * whole, the form has nothing else in it, and the six-digit length is what tells us so. Every
 * authenticator flow people are used to does this.
 *
 * TWO THINGS IT IS CAREFUL ABOUT:
 *
 *  - **It only fires on exactly six digits.** A recovery code is letters and a dash, so it never
 *    matches and the person types it at their own pace — auto-submitting a half-typed fallback
 *    would be worse than no auto-submit at all.
 *  - **It fires once per value.** Without that, a wrong code re-submits on every keystroke of the
 *    correction, hammering the rate limiter with attempts the user did not make and locking them
 *    out of their own account.
 */
export function OtpInput({
  name = "code",
  className,
  placeholder = "123456",
  ariaDescribedBy,
  autoFocus = true,
}: {
  name?: string;
  className?: string;
  placeholder?: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}) {
  const submittedFor = useRef<string | null>(null);

  return (
    <input
      name={name}
      required
      // `one-time-code` is what makes a phone offer the code from its notification, and on iOS it is
      // the difference between tapping a suggestion and retyping six digits from another app.
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      // NOT inputMode="numeric": a recovery code has letters and a dash, and a number pad would make
      // the fallback path unusable on the device most likely to need it — the one whose authenticator
      // app is gone.
      className={className}
      placeholder={placeholder}
      aria-describedby={ariaDescribedBy}
      onInput={(e) => {
        const el = e.currentTarget;
        const value = el.value.replace(/\s/g, "");
        if (!/^\d{6}$/.test(value)) {
          // Reset once it stops being a complete code, so correcting a rejected one can submit again.
          submittedFor.current = null;
          return;
        }
        if (submittedFor.current === value) return;
        submittedFor.current = value;
        // requestSubmit, not submit(): it runs validation and fires the submit event, which is what
        // React's form action is listening for. `.submit()` bypasses both and would do nothing here.
        el.form?.requestSubmit();
      }}
    />
  );
}
