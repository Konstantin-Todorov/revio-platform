"use client";

import { useActionState } from "react";
import { FIELD_LABEL, type BillingIdentityField } from "@revio/core";
import { SubmitButton } from "./submit-button.js";

/**
 * Where a hotel types its own company details for the invoices we issue it.
 *
 * ## Why it says why
 *
 * A hotel is being asked for its VAT number inside a property-management system, which is not where
 * anybody expects that question. Without a sentence explaining that this is for the invoice *we*
 * send *them* — as opposed to the invoices they send their guests, which this product also does —
 * the field is ambiguous in a way that puts the wrong company on a tax document. The two identities
 * genuinely exist in this system and they genuinely look identical on screen.
 *
 * ## Problems are shown per field, all at once
 *
 * `validateBillingIdentity` returns everything wrong in one pass. A form that reveals one fault per
 * submit is the reason people abandon them — and this one has nine fields and is filled in once,
 * probably by somebody who was told to do it.
 */

export interface BillingIdentityResult {
  ok: boolean;
  /** Field → what is wrong with it. */
  problems?: Record<string, string>;
  message?: string;
}

const FIELDS: { name: BillingIdentityField; span: 1 | 2; required?: boolean; hint?: string; placeholder?: string }[] = [
  { name: "legalName", span: 2, required: true, hint: "As registered, which may differ from the name guests know you by" },
  { name: "companyId", span: 1, hint: "EIK in Bulgaria, company number elsewhere" },
  { name: "vatId", span: 1, hint: "Leave blank if you are not VAT registered", placeholder: "BG203456789" },
  { name: "addressLine", span: 2, required: true },
  { name: "city", span: 1, required: true },
  { name: "postCode", span: 1 },
  { name: "country", span: 1, required: true, hint: "Two-letter code — it decides whether VAT applies", placeholder: "BG" },
  { name: "billingEmail", span: 1, hint: "Where invoices are sent. Blank sends them to the account owner" },
  { name: "attention", span: 2, hint: "Optional — a name or a department, so it reaches the right desk" },
];

export function BillingIdentityForm({
  values,
  action,
  selfServedAt,
}: {
  values: Record<BillingIdentityField, string>;
  action: (prev: BillingIdentityResult | null, fd: FormData) => Promise<BillingIdentityResult>;
  /** When they last saved it themselves. Null means we filled it in for them, or nobody has. */
  selfServedAt: Date | null;
}) {
  const [state, formAction] = useActionState<BillingIdentityResult | null, FormData>(action, null);
  const problems = state?.problems ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const problem = problems[f.name];
          return (
            <div key={f.name} className={f.span === 2 ? "sm:col-span-2" : ""}>
              <label htmlFor={`bi-${f.name}`} className="block text-[12px] font-semibold text-ink-700">
                {FIELD_LABEL[f.name]}
                {f.required && <span className="ml-1 text-danger-600" aria-hidden="true">*</span>}
              </label>
              <input
                id={`bi-${f.name}`}
                name={f.name}
                defaultValue={values[f.name]}
                {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                {...(f.name === "billingEmail" ? { type: "email" as const } : {})}
                {...(f.name === "country" ? { maxLength: 2, className: "" } : {})}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `bi-${f.name}-problem` : f.hint ? `bi-${f.name}-hint` : undefined}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:ring-2 focus:ring-brand-200 ${
                  problem ? "border-danger-500 bg-danger-50" : "border-surface-border bg-white focus:border-brand-500"
                }`}
              />
              {problem ? (
                <p id={`bi-${f.name}-problem`} className="mt-1 text-[11.5px] leading-snug text-danger-700">
                  {problem}
                </p>
              ) : f.hint ? (
                <p id={`bi-${f.name}-hint`} className="mt-1 text-[11.5px] leading-snug text-ink-400">
                  {f.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingLabel="Saving…"
          className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Save company details
        </SubmitButton>
        {state?.ok && (
          <span className="text-[12.5px] font-semibold text-success-700">
            Saved. Your next invoice will carry these details.
          </span>
        )}
        {state && !state.ok && state.message && (
          <span className="text-[12.5px] font-semibold text-danger-700">{state.message}</span>
        )}
        {!state && selfServedAt && (
          <span className="text-[12px] text-ink-400">
            Last updated by you on {selfServedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        )}
      </div>
    </form>
  );
}
