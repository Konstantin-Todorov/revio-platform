"use client";

import { useActionState } from "react";
import { Building2, Save } from "lucide-react";
import { saveCompany, type ActionResult } from "@/lib/actions-company";

/**
 * Our own legal identity — the issuer on every invoice we send.
 *
 * Grouped the way an accountant reads an invoice rather than the way the table is ordered: who we
 * are, where we are, how we get paid, and how the document is numbered. Fields carry short notes
 * where getting one wrong has a consequence somebody would otherwise only discover on a sent
 * document — the country decides VAT treatment, and an absent VAT number zero-rates everything.
 */

const input =
  "h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600";
const label = "mb-1 block text-[11.5px] font-semibold text-ink-600";
const hint = "mt-1 text-[11px] leading-snug text-ink-400";

export interface CompanyValues {
  legalName: string; legalNameLatin: string; vatId: string; companyId: string;
  addressLine: string; addressLineLatin: string; city: string; cityLatin: string;
  postCode: string; country: string;
  email: string; phone: string; website: string;
  iban: string; bic: string; bankName: string;
  standardVatPct: number; invoiceNumberStart: string; paymentTermsDays: number; footerNote: string;
}

export function CompanyForm({ values, canEdit }: { values: CompanyValues; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCompany, null);

  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!canEdit || pending} className="space-y-4 disabled:opacity-60">
        <div>
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">Who we are</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="legalName">Legal company name *</label>
              <input id="legalName" name="legalName" required defaultValue={values.legalName} className={input} placeholder="Уебър БГ ЕООД" />
              <p className={hint}>The registered entity exactly as it appears in the commercial register — not the brand name.</p>
            </div>
            <div>
              <label className={label} htmlFor="legalNameLatin">Same name, Latin script</label>
              <input id="legalNameLatin" name="legalNameLatin" defaultValue={values.legalNameLatin} className={input} placeholder="WEBER BG EOOD" />
              <p className={hint}>
                Used on invoices to customers outside Bulgaria — both are official names for the same
                company. Leave empty to use the one above for everybody.
              </p>
            </div>
            <div>
              <label className={label} htmlFor="vatId">VAT number</label>
              <input id="vatId" name="vatId" defaultValue={values.vatId} className={input} placeholder="BG123456789" />
              <p className={hint}>Leave empty only if you are genuinely not VAT registered — that zero-rates every invoice.</p>
            </div>
            <div>
              <label className={label} htmlFor="companyId">Company number (EIK)</label>
              <input id="companyId" name="companyId" defaultValue={values.companyId} className={input} placeholder="123456789" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">Registered address</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className={label} htmlFor="addressLine">Street address</label>
              <input id="addressLine" name="addressLine" defaultValue={values.addressLine} className={input} placeholder="ул. Преслав 6" />
            </div>
            <div className="col-span-2">
              <label className={label} htmlFor="addressLineLatin">Street address, Latin script</label>
              <input id="addressLineLatin" name="addressLineLatin" defaultValue={values.addressLineLatin} className={input} placeholder="6 Preslav St" />
              <p className={hint}>Travels with the Latin name — an invoice never mixes the two scripts.</p>
            </div>
            <div>
              <label className={label} htmlFor="postCode">Post code</label>
              <input id="postCode" name="postCode" defaultValue={values.postCode} className={input} placeholder="1000" />
            </div>
            <div>
              <label className={label} htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={values.city} className={input} placeholder="Русе" />
            </div>
            <div>
              <label className={label} htmlFor="cityLatin">City, Latin</label>
              <input id="cityLatin" name="cityLatin" defaultValue={values.cityLatin} className={input} placeholder="Ruse" />
            </div>
            <div>
              <label className={label} htmlFor="country">Country *</label>
              <input id="country" name="country" required maxLength={2} defaultValue={values.country} className={`${input} uppercase`} placeholder="BG" />
              <p className={hint}>Two letters. Decides domestic VAT vs reverse charge.</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">How clients reach us</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="email">Billing email</label>
              <input id="email" name="email" type="email" defaultValue={values.email} className={input} placeholder="office@reviosoft.app" />
            </div>
            <div>
              <label className={label} htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={values.phone} className={input} placeholder="+359 …" />
            </div>
            <div>
              <label className={label} htmlFor="website">Website</label>
              <input id="website" name="website" defaultValue={values.website} className={input} placeholder="reviosoft.app" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">How we get paid</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label} htmlFor="iban">IBAN</label>
              <input id="iban" name="iban" defaultValue={values.iban} className={input} placeholder="BG00XXXX00000000000000" />
              <p className={hint}>Printed on every invoice. Check it character by character before saving.</p>
            </div>
            <div>
              <label className={label} htmlFor="bic">BIC / SWIFT</label>
              <input id="bic" name="bic" defaultValue={values.bic} className={input} />
            </div>
            <div className="col-span-3">
              <label className={label} htmlFor="bankName">Bank name</label>
              <input id="bankName" name="bankName" defaultValue={values.bankName} className={input} />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">Invoice settings</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label} htmlFor="standardVatPct">Standard VAT rate (%)</label>
              <input id="standardVatPct" name="standardVatPct" type="number" min={0} max={99} defaultValue={values.standardVatPct} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="invoiceNumberStart">First invoice number</label>
              <input
                id="invoiceNumberStart" name="invoiceNumberStart" inputMode="numeric" pattern="[0-9]*"
                defaultValue={values.invoiceNumberStart} className={`${input} tnum`} placeholder="1000000000"
              />
              <p className={hint}>
                Ten digits, digits only — Bulgarian law requires that, ascending with no gaps and no
                repeats. Keep this clear of the numbers already issued by hand. Locked once the first
                invoice is issued.
              </p>
            </div>
            <div>
              <label className={label} htmlFor="paymentTermsDays">Payment terms (days)</label>
              <input id="paymentTermsDays" name="paymentTermsDays" type="number" min={0} max={365} defaultValue={values.paymentTermsDays} className={input} />
            </div>
            <div className="col-span-3">
              <label className={label} htmlFor="footerNote">Invoice footer</label>
              <input id="footerNote" name="footerNote" defaultValue={values.footerNote} className={input} placeholder="Thank you for your business." />
            </div>
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
          <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save company details"}
        </button>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-400">
          <Building2 className="h-3.5 w-3.5" /> Only a super admin can change these.
        </p>
      )}
    </form>
  );
}
