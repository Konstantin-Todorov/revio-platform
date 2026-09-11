"use server";

import { revalidatePath } from "next/cache";
import { saveHotelBillingIdentity } from "@revio/db";
import { validateBillingIdentity, type BillingIdentity, type BillingIdentityField } from "@revio/core";
import type { BillingIdentityResult } from "@revio/ui/billing-identity-form";
import { guard } from "./authz";

const FIELDS: BillingIdentityField[] = [
  "legalName", "country", "companyId", "vatId",
  "addressLine", "city", "postCode", "billingEmail", "attention",
];

/**
 * The hotel saving its own company details for the invoices we issue it.
 *
 * ⚠️ **The tenant comes from the session, never from the form.** Everything else on this form is
 * free text the browser supplies, which is fine — it is their own address — but the row it lands on
 * must not be choosable by the caller.
 *
 * Validation runs on the server whatever the browser did, because `required` on an input is a
 * courtesy and not a check. The refusal is returned per field rather than as one sentence: this
 * form has nine fields, is filled in once, and probably by somebody who was asked to do it.
 */
export async function saveBillingIdentity(
  _prev: BillingIdentityResult | null,
  fd: FormData,
): Promise<BillingIdentityResult> {
  const g = await guard("manageSubscription");
  if (!g.ok) return { ok: false, message: g.error };

  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(fd.get(f) ?? "").trim()]),
  ) as unknown as BillingIdentity;

  const problems = validateBillingIdentity(values);
  if (problems.length > 0) {
    return {
      ok: false,
      problems: Object.fromEntries(problems.map((p) => [p.field, p.message])),
      message: "Nothing was saved — see the fields marked below.",
    };
  }

  await saveHotelBillingIdentity({ tenantId: g.session.tenantId, values });
  revalidatePath("/settings/billing", "layout");
  return { ok: true };
}
