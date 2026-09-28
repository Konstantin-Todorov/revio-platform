"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef, type ComponentProps, type FormHTMLAttributes } from "react";

/**
 * A `<form>` for a `useActionState` action that keeps what was typed when the server says no.
 *
 * ## The defect this exists for
 *
 * React 19 resets a form after its `action` finishes **without throwing** — and a refusal returned as
 * `{ ok: false, error }` does not throw. So every one of these forms cleared itself at the exact
 * moment it told the person what was wrong: the error appeared above an empty form.
 *
 * Found 2026-09-28 because two colleagues gave up adding a client in the Operator console. They
 * filled in the whole form, the server refused ("A user with that email already exists"), and they
 * were left with the refusal and nothing else — organisation, property, owner, language and products
 * all gone. Measured, not assumed: the FormData before submit held every field; after the refusal it
 * held none. The same shape was on ~70 forms across all five apps.
 *
 * ## What it does
 *
 * On submit it takes a copy of the form's values. When the action's state arrives and is a
 * **refusal** (see `refused`), it writes that copy back into the fields — after React's reset, which runs
 * in the commit before layout effects. A success keeps React's reset, because an emptied form is the
 * right answer once the thing was created (and most of these dialogs close on success anyway).
 *
 * Kept as a `<form action>` rather than an `onSubmit` handler on purpose: `useFormStatus` — which
 * `SubmitButton` uses to disable itself and stop a second press — only sees a form's own action.
 */
type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => void;
  /** The `useActionState` state for this form's action. */
  state: unknown;
};

/**
 * A refusal, by the shapes these actions actually return: `{ ok: false, … }`, or an `error` string
 * (`{ error }`, `{ step, error }`). Anything else is treated as a success and left to React's reset —
 * restoring a form that DID save would leave a posted note sitting in its box, which is worse.
 */
function refused(state: unknown): boolean {
  if (typeof state !== "object" || state === null) return false;
  const s = state as { ok?: unknown; error?: unknown };
  return s.ok === false || (typeof s.error === "string" && s.error.length > 0);
}

/** Put a snapshot back into the form's fields. Hidden and file inputs are left alone. */
function restore(form: HTMLFormElement, snapshot: [string, FormDataEntryValue][]) {
  const byName = new Map<string, string[]>();
  for (const [k, v] of snapshot) if (typeof v === "string") (byName.get(k) ?? byName.set(k, []).get(k)!).push(v);
  const seen = new Map<string, number>();
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    const name = el.name;
    if (!name) continue;
    const values = byName.get(name) ?? [];
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden" || el.type === "file" || el.type === "submit" || el.type === "button") continue;
      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = values.includes(el.value);
        continue;
      }
    }
    if (el instanceof HTMLSelectElement && el.multiple) {
      for (const o of Array.from(el.options)) o.selected = values.includes(o.value);
      continue;
    }
    // Several fields can share a name; they are restored in document order.
    const i = seen.get(name) ?? 0;
    seen.set(name, i + 1);
    if (values[i] !== undefined) el.value = values[i]!;
  }
}

export const ActionForm = forwardRef<HTMLFormElement, Props>(function ActionForm({ action, state, onSubmit, ...rest }, forwarded) {
  const own = useRef<HTMLFormElement | null>(null);
  const snapshot = useRef<[string, FormDataEntryValue][] | null>(null);

  const setRef = useCallback(
    (el: HTMLFormElement | null) => {
      own.current = el;
      if (typeof forwarded === "function") forwarded(el);
      else if (forwarded) forwarded.current = el;
    },
    [forwarded],
  );

  const capture: NonNullable<ComponentProps<"form">["onSubmit"]> = (e) => {
    snapshot.current = Array.from(new FormData(e.currentTarget).entries());
    onSubmit?.(e);
  };

  useLayoutEffect(() => {
    const form = own.current;
    const taken = snapshot.current;
    snapshot.current = null;
    if (!form || !taken || !refused(state)) return;
    restore(form, taken);
  }, [state]);

  return <form ref={setRef} action={action} onSubmit={capture} {...rest} />;
});
