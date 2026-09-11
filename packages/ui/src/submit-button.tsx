"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * A submit button that admits it is working.
 *
 * ## The defect this exists for
 *
 * A `<form action={serverAction}>` inside a server component has **no feedback of any kind** while
 * the action runs. The browser does not navigate, nothing spins, the button does not move. For as
 * long as the server is busy, a working screen and a broken one are pixel-identical.
 *
 * That is how the operator's "Start a trial" button was reported on 2026-09-11: *"нищо не се
 * случва, трябва да презаредя"* — nothing happens, I have to reload. The trial was in fact being
 * granted every time. The action was simply slow (it awaited an email send with no timeout — see
 * `@revio/email` `EMAIL_TIMEOUT_MS`), and a slow action with no pending state is indistinguishable
 * from a dead one. The reload then showed the trial, which made it look intermittent.
 *
 * This is the same family as the flash cookie: `flash.ts` made a **refused** action say so, and this
 * makes an **in-flight** action say so. Both exist because a form that shows nothing is read by the
 * person in front of it as software that does not work, and their next move is to press it again.
 *
 * ## Why the pressed button is singled out
 *
 * `useFormStatus().pending` is true for the whole form, so on a form with three product buttons all
 * three would claim to be starting. `data` carries the submitted FormData, so comparing this
 * button's own `name`/`value` against it marks only the one that was actually pressed. The others
 * disable — which is the second half of the job, because a double-press on a form like this is a
 * second attempt at something already underway.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  name,
  value,
  title,
  formAction,
}: {
  children: ReactNode;
  /** What it says while it works. Keep it a verb in progress: "Starting…", not "Please wait". */
  pendingLabel?: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  title?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending, data } = useFormStatus();
  // Only the button that was pressed. A form with no named buttons has one, so it is that one.
  const isThis = pending && (name === undefined || data?.get(name) === value);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={isThis || undefined}
      {...(name !== undefined ? { name } : {})}
      {...(value !== undefined ? { value } : {})}
      {...(title ? { title } : {})}
      {...(formAction ? { formAction } : {})}
      /*
       * `disabled:` styling rather than a spinner: the label changing to "Starting…" already says
       * what is happening in words, and a spinner beside changed text is two answers to one
       * question. The cursor is the third signal, for a mouse user who is about to click again.
       */
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {isThis && pendingLabel ? pendingLabel : children}
    </button>
  );
}
