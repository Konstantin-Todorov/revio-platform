"use client";

import { useActionState } from "react";
import { Save, Receipt } from "lucide-react";
import { saveClientBilling, type ActionResult } from "@/lib/actions-company";

/**
 * A client's LEGAL identity, for the invoice we send them.
 *
 * Distinct from everything else on the client page, which is our opinion of a relationship. This is
 * what gets printed on a tax document, so the copy leans on the two mistakes that actually happen:
 * entering the trading name instead of the registered entity, and leaving the VAT number blank for
 * an EU customer — which silently turns a reverse-charge sale into one we have to add 20% to.
 */

const input =
  "h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600";
const label = "mb-1 block text-[11.5px] font-semibold text-ink-600";
const hint = "mt-1 text-[11px] leading-snug text-ink-400";

export interface ClientBillingValues {
  legalName: string; vatId: string; companyId: string;
  addressLine: string; city: string; postCode: string; country: string;
  billingEmail: string; attention: string; notes: string;
}

export function ClientBillingForm({
  tenantId, tradingName, values, canEdit,
}: {
  tenantId: string;
  /** The name we know them by, offered as a starting point for the legal name. */
  tradingName: string;
  values: ClientBillingValues;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveClientBilling, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <fieldset disabled={!canEdit || pending} className="space-y-3 disabled:opacity-60">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={label} htmlFor="legalName">Legal company name *</label>
            <input id="legalName" name="legalName" required defaultValue={values.legalName} className={input} placeholder={tradingName} />
            <p className={hint}>The entity that owes the money — often not the same as “{tradingName}”.</p>
          </div>
          <div>
            <label className={label} htmlFor="vatId">VAT number</label>
            <input id="vatId" name="vatId" defaultValue={values.vatId} className={input} placeholder="BG123456789" />
            <p className={hint}>For an EU client outside our country this is what makes it reverse charge.</p>
          </div>
          <div>
            <label className={label} htmlFor="companyId">Company number</label>
            <input id="companyId" name="companyId" defaultValue={values.companyId} className={input} />
          </div>

          <div className="col-span-4">
            <label className={label} htmlFor="addressLine">Registered address</label>
            <input id="addressLine" name="addressLine" defaultValue={values.addressLine} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="postCode">Post code</label>
            <input id="postCode" name="postCode" defaultValue={values.postCode} className={input} />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="city">City</label>
            <input id="city" name="city" defaultValue={values.city} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="country">Country *</label>
            <input id="country" name="country" required maxLength={2} defaultValue={values.country} className={`${input} uppercase`} placeholder="BG" />
            <p className={hint}>Two letters. Decides the VAT.</p>
          </div>

          <div className="col-span-2">
            <label className={label} htmlFor="billingEmail">Billing email</label>
            <input id="billingEmail" name="billingEmail" type="email" defaultValue={values.billingEmail} className={input} placeholder="accounts@…" />
            <p className={hint}>Where the invoice goes — usually not the owner&rsquo;s personal address.</p>
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="attention">For the attention of</label>
            <input id="attention" name="attention" defaultValue={values.attention} className={input} placeholder="Accounts payable" />
          </div>
          <div className="col-span-4">
            <label className={label} htmlFor="notes">Billing notes</label>
            <input id="notes" name="notes" defaultValue={values.notes} className={input} placeholder="Purchase-order number required on every invoice, pays on the 15th…" />
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-medium text-success-600">{state.message}</p>
      )}

      {canEdit ? (
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save billing details"}
        </button>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-400">
          <Receipt className="h-3.5 w-3.5" /> Only a super admin can change these.
        </p>
      )}
    </form>
  );
}
