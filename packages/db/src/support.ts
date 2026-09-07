import { forSystem } from "./rls.js";
import {
  supportKind,
  supportReference,
  validateSupportMessage,
  supportRefusalMessage,
  type SupportRefusal,
} from "@revio/core";

/**
 * Record a request for help, and hand back the reference the hotel is shown.
 *
 * Shared rather than written three times. Each product needs its own gated server action — that is
 * the perimeter and it cannot be shared — but the *write*, the validation and the refusal wording
 * must be identical, or the same problem reported from RevioPMS and RevioCRS produces two different
 * records and two different apologies.
 *
 * ## It writes on the SYSTEM perimeter, deliberately
 *
 * The caller has already established who is asking; `tenantId` is passed in and stamped on the row.
 * Going through the tenant proxy would be tidier in principle and worse in practice: a hotel whose
 * session or entitlements are in a bad state is *exactly* the hotel that needs to reach us, and a
 * support form that fails for the same reason the product is failing is not a support form.
 */
export interface SupportRequestInput {
  tenantId: string;
  propertyId?: string | null;
  userId?: string | null;
  /** cm | crs | pms */
  product: string;
  route?: string | null;
  kind: string;
  message: string;
  contactName: string;
  contactEmail: string;
}

export type SupportResult =
  | { ok: true; id: string; reference: string }
  | { ok: false; error: string; refusal?: SupportRefusal };

export async function recordSupportRequest(input: SupportRequestInput): Promise<SupportResult> {
  const refusal = validateSupportMessage(input.message);
  if (refusal) return { ok: false, error: supportRefusalMessage(refusal), refusal };

  if (!input.contactEmail.trim()) {
    // Without this there is nowhere to reply, and a request nobody can answer is worse than none.
    return { ok: false, error: "We have no email address for your account, so we could not reply. Ask your administrator to add one." };
  }

  const row = await forSystem().supportRequest.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId ?? null,
      userId: input.userId ?? null,
      product: input.product,
      route: input.route ?? null,
      // Normalised through core, so an unexpected value becomes `problem` rather than an urgent
      // nobody agreed to or a kind the queue cannot count.
      kind: supportKind(input.kind).key,
      message: input.message.trim(),
      contactName: input.contactName.trim() || "Unknown",
      contactEmail: input.contactEmail.trim(),
    },
    select: { id: true },
  });

  return { ok: true, id: row.id, reference: supportReference(row.id) };
}
