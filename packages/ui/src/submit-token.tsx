"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SUBMIT_TOKEN_FIELD } from "@revio/core";

/**
 * A one-time token for the form it sits in — the browser half of "press once". The server accepts
 * each token once (`claimSubmitToken` in `@revio/db`); see the `SubmitToken` model for why.
 *
 * ## Three details that make it work
 *
 * - **Minted on the server render and KEPT on hydration.** A press before React has hydrated is a
 *   plain HTML form post, and it can only carry what the server rendered. So the input is
 *   uncontrolled (`defaultValue`) and `suppressHydrationWarning`: the client's own first value
 *   differs, and must not replace the one already in the page.
 * - **Renewed when a submission FINISHES.** The same form is used again and again without a reload
 *   — two charges posted to one folio in a row are two real charges. A token that did not change
 *   would refuse the second. So when `pending` falls, the next press gets a new token.
 * - **Every `SubmitButton` renders one.** That is where the forms that create things already are
 *   (`submit-lint`), so no form has to remember. A form with its own button renders this directly.
 */
export function SubmitTokenField() {
  const { pending } = useFormStatus();
  const [initial] = useState(() => globalThis.crypto.randomUUID());
  const ref = useRef<HTMLInputElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending && ref.current) ref.current.value = globalThis.crypto.randomUUID();
    was.current = pending;
  }, [pending]);
  return <input ref={ref} type="hidden" name={SUBMIT_TOKEN_FIELD} defaultValue={initial} suppressHydrationWarning />;
}
