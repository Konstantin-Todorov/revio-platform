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
  /** app | phone | email | meeting. Defaults to the in-app form. */
  source?: string;
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
      source: input.source ?? "app",
    },
    select: { id: true },
  });

  return { ok: true, id: row.id, reference: supportReference(row.id) };
}

/**
 * Add a message to a thread.
 *
 * Shared, because both sides write one and the rules must be identical: the same emptiness check,
 * the same trimming, the same shape of row. The CALLER decides the side and does the emailing —
 * only it knows who is speaking and whether the mail went out.
 */
export interface SupportMessageInput {
  requestId: string;
  side: "hotel" | "revio";
  authorName: string;
  body: string;
  /** Set by the caller after a successful send. Null means it stayed in the system only. */
  emailedAt?: Date | null;
}

export async function addSupportMessage(
  input: SupportMessageInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > 8000) return { ok: false, error: "That is too long to send in one message." };

  const row = await forSystem().supportMessage.create({
    data: {
      requestId: input.requestId,
      side: input.side,
      authorName: input.authorName.trim() || "Unknown",
      body,
      emailedAt: input.emailedAt ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

/**
 * One request with its whole thread, for a hotel.
 *
 * Scoped by `tenantId` in the query as well as by row-level security. The database would refuse a
 * foreign row anyway; asking for the right one is how the code says what it meant, and it means a
 * missing row reads as "not found" rather than as an empty page.
 */
export async function getSupportThreadForTenant(tenantId: string, requestId: string) {
  return forSystem().supportRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/** Every request a hotel has raised, newest first, with its messages. */
export async function listSupportForTenant(tenantId: string, limit = 50) {
  return forSystem().supportRequest.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * A hotel answers us, and the case comes back into the queue.
 *
 * Shared for the same reason `recordSupportRequest` is: three products need the identical rules, and
 * a reply that reopens a case in RevioCRS and quietly does not in RevioPMS is the kind of difference
 * nobody finds until a customer is ignored. Each app keeps its own gated action and its own email —
 * that is the perimeter, and it cannot be shared.
 *
 * ## Why it clears `handledAt`
 *
 * `handledAt IS NULL` is the operator's queue, and answering sets it — "replying IS answering it".
 * If a hotel's reply left it set, their answer would land on a case nobody is looking at any more,
 * which is precisely the failure this whole feature exists to prevent. So a reply reopens it, and
 * `handledById` goes with it: whoever answered last time did answer, and the thread still says so.
 *
 * The lateness clock stays honest because it is measured from `waitingSince`, not `createdAt` — see
 * `@revio/core`. Without that, reopening a three-week-old thread would report it as three weeks late
 * the instant they wrote back.
 *
 * ## Why the tenant is checked here and not only by RLS
 *
 * This writes on the system perimeter, like every other support write, so that a hotel whose session
 * or entitlements are in a bad state can still reach us — that is the whole point of a support form.
 * That means the tenant check is ours to make, and it is made against the request row itself: a
 * `requestId` from another hotel finds nothing and is refused.
 */
export async function recordHotelReply(input: {
  requestId: string;
  tenantId: string;
  authorName: string;
  body: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = forSystem();
  const request = await db.supportRequest.findFirst({
    where: { id: input.requestId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!request) return { ok: false, error: "That request no longer exists." };

  const added = await addSupportMessage({
    requestId: request.id,
    side: "hotel",
    authorName: input.authorName,
    body: input.body,
    // A hotel's own message is not something we deliver to them, so there is nothing to record.
    emailedAt: null,
  });
  if (!added.ok) return added;

  await db.supportRequest.updateMany({
    where: { id: request.id, handledAt: { not: null } },
    data: { handledAt: null, handledById: null },
  });

  return { ok: true, id: added.id };
}
