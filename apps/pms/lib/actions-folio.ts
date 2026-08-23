"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withTenantTransaction } from "@revio/db";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { ensureFolio, createSplitFolio, folioBalance } from "./folio";
import { assessMoveForReservation } from "./move-reconciliation";
import { postFolioLine } from "./posting";
import { chargeCard, refundCard } from "@revio/payments";
import { logAudit, str, int } from "./mutation-helpers";

/**
 * Session + capability gate for every action in this file.
 *
 * The nav and the layout route-guard hide screens from scoped roles, but neither stops a WRITE:
 * Next runs a server action first and re-renders (re-guards) afterwards, so a crafted POST from a
 * housekeeper or outlet account would otherwise commit before the guard ever fired. Denial
 * redirects the caller to their own home screen, so nothing downstream in the action runs.
 */
async function ctx(cap: Capability) {
  const session = await getSession();
  if (!session) throw new Error("No session");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
  return session;
}

const CHARGE_KINDS = ["minibar", "extra", "fee"];
const PAY_METHODS: Record<string, string> = {
  cash: "Cash", card: "Card", company_account: "Company account", bank_transfer: "Bank transfer",
};

/** Parse a decimal amount field (major units) into integer minor units. */
function moneyMinor(fd: FormData, key: string): number {
  const n = Number(String(fd.get(key) ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function refresh(reservationId: string) {
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/folios");
  revalidatePath("/dashboard");
}

async function openFolioId(session: { tenantId: string; activePropertyId: string }, reservationId: string): Promise<string | null> {
  const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  if (!folioId) return null;
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, select: { status: true } });
  return folio?.status === "open" ? folioId : null;
}

/** Post a charge (minibar / extra / fee) to a stay's folio. */
export async function postCharge(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const kind = str(fd, "kind");
  const description = str(fd, "description");
  const amountMinor = moneyMinor(fd, "amount");
  if (!CHARGE_KINDS.includes(kind) || !description || amountMinor <= 0) redirect(`/folio/${reservationId}?error=charge`);

  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);
  // Route through the single charge-posting service so the line is tagged (outlet + tax category).
  await postFolioLine({ tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!, kind, description, amountMinor, postedById: session.userId });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_charge", field: description, newValue: `${kind} +${amountMinor}`, userId: session.userId });
  refresh(reservationId);
}

/** Record a payment (label + amount only — no card data). */
export async function postPayment(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const method = str(fd, "method");
  const amountMinor = moneyMinor(fd, "amount");
  const ref = str(fd, "ref") || null;
  if (!PAY_METHODS[method] || amountMinor <= 0) redirect(`/folio/${reservationId}?error=payment`);

  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  // Card payments flow through the gateway boundary (spec §4.5) — we store only the token + result,
  // never a card number. Cash / company / bank are drawer/manual entries and skip the gateway.
  let description = PAY_METHODS[method]!;
  let gwRef = ref;
  if (method === "card") {
    const g = await chargeCard(amountMinor, "EUR", `Folio ${reservationId.slice(-6)}`);
    if (!g.ok) redirect(`/folio/${reservationId}?error=gateway`);
    gwRef = g.ref;
    description = g.mode === "stripe_test" ? `Card •••• ${g.last4 ?? "4242"} (test)` : "Card (mock gateway)";
  }
  await postFolioLine({ tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!, kind: "payment", description, amountMinor, method, ref: gwRef, postedById: session.userId });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_payment", field: PAY_METHODS[method], newValue: `-${amountMinor}${gwRef ? ` · ${gwRef}` : ""}`, userId: session.userId });
  refresh(reservationId);
}

/**
 * Add a recurring stay extra (spec §3.6) — "breakfast for the whole stay" accrues per night at the
 * night audit, not as a one-off charge. BOUNDARY: this never changes the CRS rate plan the guest
 * booked; the rate plan stays as sold and the folio reflects reality.
 */
export async function addStayExtra(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const name = str(fd, "name");
  const priceMinor = moneyMinor(fd, "price");
  if (!name || priceMinor <= 0) redirect(`/folio/${reservationId}?error=extra`);

  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, propertyId: session.activePropertyId }, select: { id: true } });
  if (!reservation) redirect("/folios");
  await prisma.stayExtra.create({
    data: { tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId, name, priceMinor, active: true },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "stay_extra", field: name, newValue: `${priceMinor}/night`, userId: session.userId });
  refresh(reservationId);
}

/** Stop a recurring extra. Nights already accrued stay on the folio — only future nights stop. */
export async function removeStayExtra(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const id = str(fd, "id");
  const extra = await prisma.stayExtra.findFirst({ where: { id, propertyId: session.activePropertyId }, select: { id: true, name: true } });
  if (!extra) redirect(`/folio/${reservationId}`);
  await prisma.stayExtra.delete({ where: { id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "stay_extra", field: extra!.name, newValue: "stopped", userId: session.userId });
  refresh(reservationId);
}

/**
 * Capture a deposit (spec §4.4). A deposit is NOT revenue — it's money held that may be returned.
 * The deposit TYPE decides the behaviour:
 *   held    → a `deposit_held` line in its own folio section, outside the running balance. Not a
 *             taxable supply until applied, so it carries no VAT unless the type says vatTiming=capture.
 *   applied → recorded straight as a `payment`: the balance drops now (consumption-prepayment model).
 */
export async function captureDeposit(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const depositTypeId = str(fd, "depositTypeId");
  const method = str(fd, "method") || "cash";
  const amountMinor = moneyMinor(fd, "amount");
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  const type = await prisma.depositType.findFirst({ where: { id: depositTypeId, propertyId: session.activePropertyId, active: true } });
  if (!type) redirect(`/folio/${reservationId}?error=deposit`);
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  // Card deposits are gateway transactions against the token; cash is a drawer entry (spec §4.5).
  let depositRef: string | null = null;
  if (method === "card") {
    const g = await chargeCard(amountMinor, "EUR", `${type!.name} deposit ${reservationId.slice(-6)}`);
    if (!g.ok) redirect(`/folio/${reservationId}?error=gateway`);
    depositRef = g.ref;
  }
  const applied = type!.behaviour === "applied";
  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: applied ? "payment" : "deposit_held",
    description: `${type!.name} deposit${applied ? "" : " (held)"}${depositRef ? ` · ${depositRef}` : ""}`,
    amountMinor, method, ref: depositRef, depositTypeId: type!.id,
    // VAT point: at capture only when the type says so; a held deposit is otherwise not yet taxable.
    ...(applied ? {} : { taxCategory: type!.vatTiming === "capture" ? ("standard" as const) : null }),
    postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_capture", field: type!.name, newValue: `${applied ? "applied" : "held"} ${amountMinor}`, userId: session.userId });
  refresh(reservationId);
}

/** Apply held deposit money to the bill — only NOW does it count as a payment (and the VAT point
 * triggers for a vatTiming=use type). Capped at what's actually held. */
export async function useDeposit(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  const lines = await prisma.folioLine.findMany({ where: { folioId: folioId! }, select: { kind: true, amountMinor: true, voided: true } });
  const { depositsHeld, balance } = folioBalance(lines);
  const requested = moneyMinor(fd, "amount");
  // Never apply more than is held, nor more than is owed.
  const amountMinor = Math.min(requested > 0 ? requested : depositsHeld, depositsHeld, Math.max(0, balance));
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: "deposit_use", description: "Deposit applied to balance", amountMinor,
    taxCategory: "standard", postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_use", field: "applied to balance", newValue: String(amountMinor), userId: session.userId });
  refresh(reservationId);
}

/** Return held deposit money to the guest — reduces the liability, never touches revenue. */
export async function refundDeposit(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const reservationId = str(fd, "reservationId");
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  const lines = await prisma.folioLine.findMany({ where: { folioId: folioId! }, select: { kind: true, amountMinor: true, voided: true } });
  const { depositsHeld } = folioBalance(lines);
  const requested = moneyMinor(fd, "amount");
  const amountMinor = Math.min(requested > 0 ? requested : depositsHeld, depositsHeld);
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  // Card refunds go back through the same gateway; cash refunds are a drawer entry (spec §4.5).
  const method = str(fd, "method") || "cash";
  let refundRef: string | null = null;
  if (method === "card") {
    const held = await prisma.folioLine.findFirst({ where: { folioId: folioId!, kind: "deposit_held", ref: { not: null } }, orderBy: { postedAt: "desc" }, select: { ref: true } });
    const g = await refundCard(held?.ref ?? "mock_", amountMinor);
    if (!g.ok) redirect(`/folio/${reservationId}?error=gateway`);
    refundRef = g.ref;
  }
  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: "deposit_refund", description: `Deposit refunded${refundRef ? ` · ${refundRef}` : ""}`, amountMinor,
    method, ref: refundRef, taxCategory: null, postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_refund", field: "returned to guest", newValue: String(amountMinor), userId: session.userId });
  refresh(reservationId);
}

/** Add a split / company folio to the stay (spec §3.6). Charge lines can then be moved onto it. */
export async function createFolio(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const label = str(fd, "label") || "Company";
  await createSplitFolio(session.tenantId, session.activePropertyId, reservationId, label);
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_split", field: label, newValue: "added", userId: session.userId });
  refresh(reservationId);
}

/**
 * Remove a split folio — the inverse `createFolio` never had (§1.6).
 *
 * Every create needs a lifecycle-gated inverse, and this one was missing in a way a hotel actually
 * hit: a stay in production carries two empty "Company" splits that no screen can delete. Adding one
 * by accident was a click; undoing it was impossible.
 *
 * Gated, in order of how much damage removal could do:
 *   - the PRIMARY folio is never removable — it is the stay's bill, not a split;
 *   - a CLOSED folio is never removable — closed is a financial record, corrected by credit note;
 *   - a split that still carries live lines is refused, and the caller is told to move them back
 *     first. Deleting it would take real charges with it.
 * An empty, open split removes freely, which is the case that was stuck.
 */
export async function removeFolio(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const folioId = str(fd, "folioId");

  const folio = await prisma.folio.findFirst({
    where: { id: folioId, reservationId, propertyId: session.activePropertyId },
    include: { lines: { select: { id: true, voided: true } } },
  });
  if (!folio) redirect(`/folio/${reservationId}`);
  if (folio!.isPrimary) redirect(`/folio/${reservationId}?error=folioprimary`);
  if (folio!.status !== "open") redirect(`/folio/${reservationId}?error=folioclosed`);

  // Voided lines don't count as content: they are struck-through history, and keeping an empty split
  // alive because it once held a line that was cancelled is the same dead end in slower motion. They
  // are deleted with the folio, and the void itself is already in the audit log.
  const liveLines = folio!.lines.filter((l) => !l.voided);
  if (liveLines.length > 0) redirect(`/folio/${reservationId}?error=foliolines`);

  await withTenantTransaction(session.tenantId, async (tx) => {
    await tx.folioLine.deleteMany({ where: { folioId } });
    await tx.folio.delete({ where: { id: folioId } });
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "folio_split_removed", field: folio!.label, oldValue: `folio ${folioId.slice(-6)}`, newValue: "removed", userId: session.userId,
  });
  refresh(reservationId);
}

/** The four ways a closed-outstanding folio can be resolved (§1.4). Manager-only, every one logged. */
const FOLIO_RESOLUTIONS = ["reopen", "paid_offsystem", "receivable", "written_off"] as const;

/**
 * Resolve a folio that closed carrying a balance (§1.4).
 *
 * "Closed with a balance" used to be limbo — the folio said closed and settled and owing at once, and
 * no action moved it. It is now a managed state with exactly four exits, and this is all of them:
 *
 *   reopen         — reopen the folio so a payment can be taken normally; it closes at zero.
 *   paid_offsystem — the money arrived another way (bank transfer, cash, external POS).
 *                    Revenue COLLECTED.
 *   receivable     — leave it outstanding and chase it later ("invoice sent"). Stays on the
 *                    receivables list, which is the point of that list.
 *   written_off    — the balance is forgiven. Revenue LOST.
 *
 * `paid_offsystem` and `written_off` both end at a closed folio owing nothing, and they must never be
 * reported as the same thing: one is money that arrived and one is money that did not. They are
 * recorded as different outcomes rather than as one "settled" flag for exactly that reason — an owner
 * reading "€513 written off" is reading a loss.
 *
 * Manager-only by capability. Reception still SEES these options on the folio, disabled: hiding them
 * would leave the desk unable to explain to a guest why nothing can be done.
 */
export async function resolveFolio(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const reservationId = str(fd, "reservationId");
  const folioId = str(fd, "folioId");
  const resolution = str(fd, "resolution");
  const note = str(fd, "note");

  if (!FOLIO_RESOLUTIONS.includes(resolution as (typeof FOLIO_RESOLUTIONS)[number])) {
    redirect(`/folio/${reservationId}`);
  }

  const folio = await prisma.folio.findFirst({
    where: { id: folioId, reservationId, propertyId: session.activePropertyId },
    select: { id: true, status: true, outcome: true, label: true },
  });
  if (!folio || folio.status !== "closed") redirect(`/folio/${reservationId}`);

  const now = new Date();
  await withTenantTransaction(session.tenantId, async (tx) => {
    if (resolution === "reopen") {
      await tx.folio.update({
        where: { id: folioId },
        data: { status: "open", closedAt: null, outcome: null, outcomeNote: null, outcomeAt: null, outcomeById: null },
      });
      return;
    }
    // `receivable` keeps the folio exactly where it is and only records the decision — the debt is
    // still owed, so changing the outcome would be a lie. It is a real choice, not a no-op: it says a
    // human looked at this and decided to chase it.
    const outcome = resolution === "receivable" ? "outstanding" : resolution;
    await tx.folio.update({
      where: { id: folioId },
      data: { outcome, outcomeNote: note || null, outcomeAt: now, outcomeById: session.userId },
    });
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "folio_resolution", field: folio!.label,
    oldValue: folio!.outcome ?? "closed", newValue: `${resolution}${note ? ` · ${note}` : ""}`,
    userId: session.userId,
  });
  refresh(reservationId);
}

/**
 * Read the pending reconciliation for a stay, for the calendar's prompt (§2.5/§2.6).
 *
 * A read, exposed as an action only because the calendar is a client component and needs it after a
 * drop rather than at render time. Gated like every other action: it reports what a guest is being
 * charged, which is not public information.
 */
export async function fetchMoveAssessment(reservationId: string) {
  await ctx("frontDesk");
  return assessMoveForReservation(reservationId);
}

/** The ways a cross-type move's price difference can be settled (§2.5). Which are OFFERED depends
 *  on direction and is decided in `@revio/core`; this is only what may arrive. */
const MOVE_RESOLUTIONS = ["comp", "charge", "refund", "waive", "custom"] as const;

/**
 * Settle the price difference created by moving a guest into a different room type (§2.5).
 *
 * The move itself already happened and is not in question — the guest is in the room. What is open
 * is money, and the spec insists a human classifies it rather than the system posting a difference
 * nobody chose:
 *
 *   comp   — an upgrade given away. Nothing is posted; it is recorded as a comp so it can be counted.
 *   charge — an upgrade sold. The difference is posted to the folio.
 *   refund — a downgrade with money going back to the guest.
 *   waive  — a downgrade where nothing goes back. The owed amount is simply removed.
 *   custom — any of the above at an amount the manager sets.
 *
 * **`comp` and `waive` both post nothing, and are deliberately different words.** One is a gift the
 * hotel chose to give; the other is a debt the hotel chose not to collect. Recording them as the
 * same event would lose the distinction an owner most wants out of this screen.
 *
 * Manager-only: it changes what a guest pays.
 */
export async function resolveMoveDifference(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const reservationId = str(fd, "reservationId");
  const resolution = str(fd, "resolution");
  const note = str(fd, "note");

  if (!MOVE_RESOLUTIONS.includes(resolution as (typeof MOVE_RESOLUTIONS)[number])) {
    redirect(`/folio/${reservationId}`);
  }

  const assessment = await assessMoveForReservation(reservationId);
  if (!assessment || assessment.kind !== "rate_affecting") redirect(`/folio/${reservationId}`);

  // A custom amount overrides the computed one; everything else uses what was assessed. Read as an
  // absolute value — the direction is already known, and a manager typing "-30" meaning a refund
  // must not accidentally invert it.
  const customMinor = Math.abs(int(fd, "amountMinor", 0));
  const magnitude = resolution === "custom" ? customMinor : Math.abs(assessment!.differenceMinor);

  const posts = resolution === "charge" || (resolution === "custom" && assessment!.direction === "upgrade");
  const refunds = resolution === "refund" || (resolution === "custom" && assessment!.direction === "downgrade");

  if ((posts || refunds) && magnitude > 0) {
    const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
    if (folioId) {
      await postFolioLine({
        tenantId: session.tenantId,
        propertyId: session.activePropertyId,
        folioId,
        // A refund is money going back, which on a folio is a payment in the guest's favour; an
        // upgrade charge is an ordinary extra. Both go through the one posting service, so both
        // carry the outlet and tax tagging every other line has.
        kind: refunds ? "payment" : "extra",
        outlet: refunds ? undefined : "extra",
        description: refunds
          ? `Room downgrade refund · ${assessment!.bookedRoomTypeName} → ${assessment!.accommodatedRoomTypeName}`
          : `Room upgrade · ${assessment!.bookedRoomTypeName} → ${assessment!.accommodatedRoomTypeName} (room ${assessment!.unitLabel})`,
        amountMinor: magnitude,
        ...(refunds ? { method: "refund" } : {}),
      });
    }
  }

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "move_difference",
    field: `${assessment!.bookedRoomTypeName} → ${assessment!.accommodatedRoomTypeName}`,
    oldValue: `${assessment!.direction} ${assessment!.differenceMinor}`,
    newValue: `${resolution}${magnitude ? ` · ${magnitude}` : ""}${note ? ` · ${note}` : ""}`,
    userId: session.userId,
  });
  refresh(reservationId);
}

/** Move a charge line onto another folio of the SAME stay — the one mechanism behind every split
 * (room→company, extras→guest, 50/50). Payments and closed folios are off-limits. */
export async function moveFolioLine(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const lineId = str(fd, "lineId");
  const targetFolioId = str(fd, "targetFolioId");

  const line = await prisma.folioLine.findFirst({ where: { id: lineId, propertyId: session.activePropertyId }, include: { folio: { select: { reservationId: true } } } });
  if (!line || line.voided || line.kind === "payment") redirect(`/folio/${reservationId}`);
  const target = await prisma.folio.findFirst({ where: { id: targetFolioId, reservationId, status: "open" }, select: { id: true } });
  // Both source and target must belong to THIS reservation, and the target must be open.
  if (!target || line!.folio.reservationId !== reservationId) redirect(`/folio/${reservationId}`);

  await prisma.folioLine.update({ where: { id: lineId }, data: { folioId: target!.id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_move", field: line!.description, newValue: `→ folio ${target!.id.slice(-6)}`, userId: session.userId });
  refresh(reservationId);
}

/** Void a folio line (flagged, never deleted — audit trail). Accommodation lines are authoritative and can't be voided. */
export async function voidFolioLine(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const reservationId = str(fd, "reservationId");
  const lineId = str(fd, "lineId");
  const line = await prisma.folioLine.findFirst({ where: { id: lineId, propertyId: session.activePropertyId } });
  if (!line || line.voided) redirect(`/folio/${reservationId}`);
  if (line.kind === "accommodation") redirect(`/folio/${reservationId}?error=voidaccom`);

  await prisma.folioLine.update({ where: { id: lineId }, data: { voided: true } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_void", field: line.description, oldValue: String(line.amountMinor), newValue: "voided", userId: session.userId });
  refresh(reservationId);
}
