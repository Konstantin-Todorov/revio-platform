"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { saveStripeKey, type ActionResult } from "@/lib/actions-integrations";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import type { StripeMode } from "@/lib/stripe-key";

/**
 * Where a Stripe key is pasted — the whole reason this feature exists rather than an env var.
 *
 * ## Why a screen and not a Railway variable
 *
 * The Channex keys live in environment variables and that is a real cost, visible on the
 * Integrations page as *set elsewhere*: nobody can see what is installed, nothing records who set it
 * or when, there is no way to test it, and changing it needs a deploy. A payment credential deserves
 * better than a variable somebody pasted into a dashboard eighteen months ago.
 *
 * ## The three fields, and why they are on one form
 *
 * They are three parts of one working connection, and a form that took only the secret would leave
 * two silent gaps — no card form, and no way to learn that a payment succeeded. Both are optional
 * here because a connection is genuinely useful before they are filled in, and the readiness list on
 * the page behind this says plainly which parts are still missing.
 */
/**
 * ⚠️ What is already installed, so a blank box is a choice rather than a gamble.
 *
 * Each field can be left empty to keep what is stored — see `saveStripeKey`, which is where the
 * three fields stopped meaning three different things. The dialog has to SAY that, per field, or
 * the behaviour is a secret and people re-paste everything anyway.
 */
export interface InstalledStripeKeys {
  /** Masked tail of the stored server key, e.g. `sk_test_••••yNtV`. Null when nothing is stored. */
  secretHint: string | null;
  /** Public by design, so it is shown in full — recognising it is the point. */
  publishableKey: string | null;
  hasWebhook: boolean;
}

export function StripeKeyDialog({ mode, hasKey, installed }: { mode: StripeMode; hasKey: boolean; installed: InstalledStripeKeys }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveStripeKey, null);
  useEffect(() => {
    if (state?.ok && !state.warning) setOpen(false);
  }, [state]);

  const live = mode === "live";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700"
      >
        {hasKey ? "Edit keys" : "Set up"}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Stripe · ${live ? "live" : "sandbox"} keys`}>
        {/*
          * The live warning is first, largest, and unmissable.
          *
          * This is the one field in the console where a mistake charges somebody's card. The key is
          * also validated against the mode server-side and a live key is REFUSED in the sandbox
          * slot — this notice exists for the opposite direction, where the operator is doing exactly
          * what they intend and should still be certain of it.
          */}
        {live && (
          <p className="mb-3 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-[12px] leading-relaxed text-danger-700">
            <strong className="font-semibold">These are live keys. Real cards, real money.</strong>{" "}
            Rehearse in sandbox first — the flows are identical and nothing there can charge anyone.
          </p>
        )}

        <p className="mb-3 text-[12.5px] leading-relaxed text-ink-500">
          Pasted here, <span className="font-semibold text-ink-800">encrypted before it is stored</span>{" "}
          (AES-256-GCM), and never shown again — only the last four characters, so you can recognise
          which key is installed. It is tested against Stripe before saving.
        </p>

        {hasKey && (
          <p className="mb-3 rounded-md border border-surface-border bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-ink-600">
            <span className="font-semibold text-ink-800">Leave a box empty to keep what is there.</span>{" "}
            You can fill in one field without re-entering the others — which matters most for the
            webhook secret, because Stripe shows that one exactly once.
          </p>
        )}

        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="mode" value={mode} />

          <Field
            label="Server API key"
            hint={
              installed.secretHint
                ? `Installed: ${installed.secretHint}. Leave empty to keep it — it is still re-tested against Stripe when you save.`
                : `Prefer a restricted key with Account read, Balance read and Checkout Sessions write. Starts ${live ? "rk_live_" : "rk_test_"}; a full sk_ key also works.`
            }
          >
            <input
              name="secretKey"
              type="password"
              // Required only when there is nothing to keep. This attribute is what forced the whole
              // credential to be re-entered to change any part of it.
              required={!hasKey}
              autoComplete="off"
              className={inputCls}
              placeholder={hasKey ? "unchanged" : live ? "rk_live_… or sk_live_…" : "rk_test_… or sk_test_…"}
            />
          </Field>

          <Field
            label="Publishable key"
            hint={
              installed.publishableKey
                ? `Installed: ${installed.publishableKey}. Not used by hosted Checkout — keep it for a future embedded card form.`
                : "Optional and not used by hosted Checkout. Keep it only for a future embedded card form; safe to be public."
            }
          >
            <input
              name="publishableKey"
              type="text"
              autoComplete="off"
              className={inputCls}
              placeholder={installed.publishableKey ? "unchanged" : live ? "pk_live_…" : "pk_test_…"}
            />
          </Field>

          <Field
            label="Webhook signing secret"
            hint={
              installed.hasWebhook
                ? "One is installed. Leave empty to keep it — Stripe will not show it to you a second time."
                : "Optional. Stripe shows it once, when the endpoint is added. Without it we cannot verify that an event is genuinely from Stripe."
            }
          >
            <input name="webhookSecret" type="password" autoComplete="off" className={inputCls} placeholder={installed.hasWebhook ? "unchanged" : "whsec_…"} />
          </Field>

          {state?.error && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>
          )}
          {/* Saved, but with something the operator has to know — an account Stripe has not finished
              verifying, or a key we could not reach Stripe to check. Neither is a failure and neither
              is a clean success, so the dialog stays open rather than closing on a half-answer. */}
          {state?.warning && (
            <p className="rounded-md bg-warning-50 px-3 py-2 text-[12.5px] font-medium text-warning-700">{state.warning}</p>
          )}

          <p className="text-[11.5px] leading-relaxed text-ink-400">
            A key Stripe rejects is not stored — the only reason to save one is a typo, and the fix
            for a typo is to paste it again.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
            >
              {state?.warning ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" /> {pending ? "Testing…" : "Test and save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
