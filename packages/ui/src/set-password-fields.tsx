"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";

/**
 * Choosing a password — the screen a new staff member meets first.
 *
 * There were four of these too, and unlike `login-fields.tsx` nobody had gone back over them. They
 * were missing everything the sign-in screen had learned:
 *
 *  - **No way to reveal what you are typing.** On the one screen where the characters are being
 *    invented rather than recalled, and typed twice. Reported by a founder setting up a real account.
 *  - **No Caps Lock warning**, so a password can be *created* with Caps Lock on and then refused at
 *    sign-in for a reason nobody can see on either screen.
 *  - **No `username` field**, which is why browsers were not offering to save anything. A password
 *    manager saves a *pair*; a form with a password and no identity gives it nothing to file the
 *    password under, and the new staff member walks away with a password they have not stored.
 *
 * That last one is the reason the email is rendered as a real, visible, readonly input rather than a
 * hidden one. Hidden `username` fields are ignored by some managers, and showing it is honest: this
 * is the account you are setting a password for, and on a shared computer that is worth seeing before
 * you type.
 */

export interface SetPasswordFieldsProps {
  /** The invited address. Rendered readonly so the browser can save an email + password pair. */
  email: string;
  purpose: "invite" | "reset";
  submitClassName: string;
  inputFocusClassName: string;
  pending: boolean;
  error?: string;
}

const MIN_LENGTH = 10;

export function SetPasswordFields({
  email,
  purpose,
  submitClassName,
  inputFocusClassName,
  pending,
  error,
}: SetPasswordFieldsProps) {
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  const inputCls = `h-10 w-full rounded-md border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 ${inputFocusClassName}`;
  const borderCls = error ? "border-danger-500" : "border-surface-border";

  // Said while they type, not after they submit. Retyping both boxes because the second one did not
  // match is the most avoidable friction on this screen.
  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && password === confirm;
  const mismatch = confirm.length > 0 && !matches;

  return (
    <>
      {/*
        The identity half of the pair. `readOnly` rather than `disabled`: a disabled input is not
        submitted and is skipped by password managers, which would defeat the entire purpose.
      */}
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Your email</span>
        <input
          name="username"
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          className={`${inputCls} border-surface-border bg-surface-muted text-ink-500`}
        />
      </label>

      <label className="block" htmlFor={passwordId}>
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">New password</span>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={reveal ? "text" : "password"}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
            onBlur={() => setCapsLock(false)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${inputCls} ${borderCls} pr-10`}
            placeholder={`At least ${MIN_LENGTH} characters`}
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            aria-label={reveal ? "Hide password" : "Show password"}
            // Out of the tab order, same as sign-in: tabbing out of the password should reach the
            // confirm box, not a toggle.
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-ink-400 transition-colors hover:text-ink-700"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && <p className="mt-1 text-[11.5px] font-medium text-warning-600">Caps Lock is on.</p>}
        {password.length > 0 && !longEnough && (
          <p className="mt-1 text-[11.5px] text-ink-500">
            {MIN_LENGTH - password.length} more character{MIN_LENGTH - password.length === 1 ? "" : "s"}.
          </p>
        )}
      </label>

      <label className="block" htmlFor={confirmId}>
        <span className="mb-1 block text-[12.5px] font-semibold text-ink-700">Confirm password</span>
        <input
          id={confirmId}
          name="confirm"
          // Follows the reveal toggle: revealing one box and masking the other makes comparing them
          // impossible, which is the only reason to have two boxes at all.
          type={reveal ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch || error ? true : undefined}
          className={`${inputCls} ${mismatch ? "border-danger-500" : borderCls}`}
          placeholder="Type it again"
        />
        {mismatch && <p className="mt-1 text-[11.5px] font-medium text-danger-600">These don&apos;t match yet.</p>}
        {matches && longEnough && (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-success-600">
            <Check className="h-3 w-3" /> Passwords match.
          </p>
        )}
      </label>

      {error && (
        <p id={errorId} role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending || !longEnough || !matches} className={submitClassName}>
        {pending ? "Saving…" : purpose === "invite" ? "Save password and continue" : "Change my password"}
      </button>

      {/* Says what happens next, because it is not what people assume. Setting a password does not
          sign you in — and if somebody else is signed in on this computer, they are signed out. */}
      <p className="pt-1 text-center text-[11.5px] leading-relaxed text-ink-400">
        {purpose === "invite"
          ? "You'll sign in with this on the next screen. Let your browser save it."
          : "You'll be asked to sign in again with the new password."}
      </p>
    </>
  );
}
