"use server";

import { revalidatePath } from "next/cache";
import { saveHotelBillingIdentity } from "@revio/db";
import { validateBillingIdentity, type BillingIdentity, type BillingIdentityField } from "@revio/core";
import type { BillingIdentityResult } from "@revio/ui/billing-identity-form";
import { requireCapability } from "./authz";

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
  /*
   * ⚠️ RevioPMS keeps its OWN capability list, because its roles are operational — `manager`,
   * `reception`, `housekeeper` and three more that the commercial grants in `@revio/core` know
   * nothing about. `subscription` there is owner+admin, deliberately narrower than `manage`, which
   * a manager holds. Same question as the other two products, different vocabulary.
   */
  const session = await requireCapability("subscription");
  if (!session) {
    return { ok: false, message: "Only the owner or an admin can change what this account pays for. Ask one of them." };
  }

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

  await saveHotelBillingIdentity({ tenantId: session.tenantId, values });
  revalidatePath("/settings/billing", "layout");
  return { ok: true };
}
