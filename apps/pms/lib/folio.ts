import "server-only";
import { computeStayCharges, isCityTax } from "@revio/core";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { postFolioLineWith } from "./posting";
import { MANAGER_ROLES } from "./roles";
import { ymd, todayInTz } from "./format";
import type { HkStatus } from "./hk-meta";
import { summariseOutcomes, outcomeHeadline, type OutcomeTotal } from "./folio-outcomes";

export type FolioLineRow = {
  id: string; kind: string; description: string; amountMinor: number;
  method: string | null; ref: string | null; voided: boolean; postedAt: Date;
};

/**
 * Balance = Σ(non-voided charges) − Σ(non-voided payments).
 *
 * DEPOSITS ARE A LIABILITY, not revenue and not an ordinary payment (spec §4.4) — booking one as
 * either breaks both night-audit revenue and the folio balance. So a HELD deposit sits in its own
 * bucket, outside charges AND payments:
 *   deposit_held    → money held that may be returned (liability+)
 *   deposit_refund  → held money returned to the guest (liability−)
 *   deposit_use     → held money APPLIED to the bill — only now does it count as a payment
 * An APPLIED-behaviour deposit never uses these kinds: it's captured straight as a `payment`.
 */
export function folioBalance(lines: { kind: string; amountMinor: number; voided: boolean }[]) {
  let charges = 0, payments = 0, depositsHeld = 0;
  for (const l of lines) {
    if (l.voided) continue;
    switch (l.kind) {
      case "payment": payments += l.amountMinor; break;
      case "deposit_held": depositsHeld += l.amountMinor; break;
      case "deposit_refund": depositsHeld -= l.amountMinor; break;
      case "deposit_use": depositsHeld -= l.amountMinor; payments += l.amountMinor; break;
      default: charges += l.amountMinor;
    }
  }
  return { charges, payments, balance: charges - payments, depositsHeld };
}

/** The property's city-tax fee, by name — the one fee the CRS's cityTaxMode can suppress. */
// Re-exported so existing PMS imports keep working; the rule itself lives in @revio/core alongside
// the fee maths that honours it.
export { isCityTax };

/**
 * Ensure a stay has a folio, creating + seeding it on first use (accommodation from the reservation
 * rate, excluded taxes/fees, and — for OTA-prepaid bookings — an auto payment that zeroes the balance).
 * Idempotent + race-safe via the unique reservationId. Called at check-in / walk-in and lazily on the
 * folio page (for stays checked in before Phase 3).
 */
export async function ensureFolio(tenantId: string, propertyId: string, reservationId: string, db: typeof prisma = prisma): Promise<string | null> {
  // The PRIMARY (guest) folio; split/company folios (spec §3.6) are added on top and never seeded here.
  const existing = await db.folio.findFirst({ where: { reservationId, isPrimary: true }, select: { id: true } });
  if (existing) return existing.id;

  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, propertyId },
    include: {
      lines: {
        include: {
          roomType: { select: { name: true } },
          // What each night was QUOTED at (§P4). The folio bills this, not a live re-resolve.
          nightRates: { orderBy: { date: "asc" } },
        },
      },
    },
  });
  if (!reservation) return null;

  const currency = reservation.currency || "EUR";
  const created = await db.folio.create({ data: { tenantId, propertyId, reservationId, currency, isPrimary: true, label: "Guest" }, select: { id: true } });
  const folioId = created.id;

  const base = { tenantId, propertyId, folioId };
  let accomTotal = 0;
  let nights = 1, rooms = 0, guests = 0;
  const cis = reservation.lines.map((l) => l.checkIn.getTime());
  const cos = reservation.lines.map((l) => l.checkOut.getTime());
  if (cis.length) nights = Math.max(1, Math.round((Math.max(...cos) - Math.min(...cis)) / 86_400_000));

  // Safety net for a line that arrived without its own price. Some channels only send a booking
  // total, and reservations imported before the per-line price was carried have none stored. Falling
  // back to zero would silently hand the guest a bill with the room at 0.00 — so apportion the
  // booking total across its lines instead, weighted by quantity.
  const totalQty = reservation.lines.reduce((s, l) => s + (l.quantity || 1), 0) || 1;
  const bookingTotal = reservation.propertyTotalMinor ?? reservation.totalMinor ?? 0;
  const missingPrice = reservation.lines.some((l) => l.priceMinor == null);

  for (const line of reservation.lines) {
    /*
     * The nightly snapshot is authoritative — PMS OBP §P4 (K3/K6).
     *
     * `line.priceMinor` is the stay total as it stood at booking. The snapshot is the same money
     * broken down per night AND per occupancy, which is what a per-person stay needs: it survives a
     * mid-stay occupancy change (which reprices only forward) and it lets the folio say what party
     * size each night was priced at.
     *
     * The line total is preferred only when there is no snapshot — a stay booked before OBP, or one
     * imported without nightly rates. The two agree at booking by construction; if they ever
     * disagree the snapshot wins, because it is what the guest was quoted per night.
     */
    const snapshot = line.nightRates ?? [];
    const snapshotTotal = snapshot.reduce((sum, n) => sum + n.rateMinor, 0);
    const price = snapshot.length > 0
      ? snapshotTotal
      : line.priceMinor ?? (missingPrice ? Math.round((bookingTotal * (line.quantity || 1)) / totalQty) : 0);

    accomTotal += price;
    rooms += line.quantity;
    guests += line.guestsCount ?? line.quantity;

    /*
     * The occupancy the room was priced at, on the folio line (K6).
     *
     * Without it a per-person bill is a number with no explanation: a guest querying why their room
     * is €95 and not €120 gets "that is the rate", and the receptionist has no way to show them it
     * is the one-guest price. Only shown when it varies from the room's own default — a per-room
     * stay's line must read exactly as it does today.
     */
    const occ = snapshot.length > 0 ? [...new Set(snapshot.map((n) => n.occupancy))] : [];
    const occLabel = occ.length === 1 ? ` · ${occ[0]}p` : occ.length > 1 ? ` · ${Math.min(...occ)}–${Math.max(...occ)}p` : "";

    // Seed accommodation via the charge-posting service too — no direct FolioLine writes (spec §1.7).
    await postFolioLineWith(db, { ...base, kind: "accommodation", description: `${line.roomType.name}${occLabel} · ${ymd(line.checkIn)}→${ymd(line.checkOut)}`, amountMinor: price });
  }

  // CITY-TAX SUPPRESSION (spec §3.6): the CRS decides whether city tax is payable on spot or already
  // included in the rate. When it's "included", the PMS must NOT post the Fee line — the guest has
  // already paid it in the rate, and posting it here would double-charge. Both CRS modes are honoured.
  const defaults = await db.propertyDefaults.findUnique({ where: { propertyId }, select: { cityTaxMode: true } });
  const cityTaxIncluded = defaults?.cityTaxMode === "included";

  // The SAME function the booking engine quotes with (@revio/core). If these two ever computed
  // fees separately they would drift, and a guest quoted 240.00 online would be billed something
  // else on arrival — the one thing the booking flow promises cannot happen.
  const fees = await db.taxFee.findMany({ where: { propertyId, active: true, inclusion: "excluded" } });
  const charges = computeStayCharges({
    stay: { accommodationMinor: accomTotal, nights, rooms, guests },
    fees,
    cityTaxIncluded,
  });
  for (const line of charges.lines) {
    await postFolioLineWith(db, { ...base, kind: line.kind, description: line.name, amountMinor: line.amountMinor });
  }

  if (reservation.paymentGuarantee === "prepaid_ota") {
    const charges = (await db.folioLine.findMany({ where: { folioId, voided: false, kind: { not: "payment" } }, select: { amountMinor: true } })).reduce((s, l) => s + l.amountMinor, 0);
    if (charges > 0) await postFolioLineWith(db, { ...base, kind: "payment", description: "Prepaid via OTA", amountMinor: charges, method: "prepaid_ota" });
  }
  return folioId;
}

/** The folio view for /folio/[reservationId]: ensures the primary folio exists, returns reservation +
 * EVERY folio for the stay (primary + split/company) with per-folio and combined balance (spec §3.6). */
export async function getFolioView(reservationId: string) {
  const { session, property } = await activeProperty();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: { guest: true, lines: { include: { roomType: { select: { name: true } } } }, assignments: { where: { status: "active", checkedOutAt: null }, include: { unit: { select: { label: true } } } } },
  });
  if (!reservation) return null;

  await ensureFolio(session.tenantId, property.id, reservationId);
  const folioRows = await prisma.folio.findMany({
    where: { reservationId },
    orderBy: [{ isPrimary: "desc" }, { openedAt: "asc" }],
    include: { lines: { orderBy: { postedAt: "asc" } } },
  });
  if (folioRows.length === 0) return null;

  const folios = folioRows.map((f) => ({ ...f, totals: folioBalance(f.lines) }));
  const currency = folios[0]!.currency;
  const combined = folios.reduce(
    (s, f) => ({
      charges: s.charges + f.totals.charges,
      payments: s.payments + f.totals.payments,
      balance: s.balance + f.totals.balance,
      depositsHeld: s.depositsHeld + f.totals.depositsHeld,
    }),
    { charges: 0, payments: 0, balance: 0, depositsHeld: 0 },
  );
  // Any other open folio of THIS stay a line could be moved to.
  const moveTargets = folios.map((f) => ({ id: f.id, label: f.label }));
  const [depositTypes, stayExtras] = await Promise.all([
    prisma.depositType.findMany({ where: { propertyId: property.id, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.stayExtra.findMany({ where: { reservationId, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  // `isManager` is returned so the folio screen can show the manager-only resolutions to EVERYONE and
  // merely disable them (§1.4). Hiding them would leave reception looking at a balance they cannot
  // explain; showing them locked says "this is handled, by someone else" — which is the true state.
  return {
    property, reservation, folios, currency, combined, moveTargets, depositTypes, stayExtras,
    isManager: MANAGER_ROLES.has(session.role),
  };
}

/** Combined balance across all a reservation's folios — the true amount owed at check-out. */
export async function reservationBalance(reservationId: string): Promise<number> {
  const folios = await prisma.folio.findMany({ where: { reservationId }, include: { lines: { select: { kind: true, amountMinor: true, voided: true } } } });
  return folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0);
}

export interface TimelineEvent { at: Date; label: string; detail?: string; kind: "booking" | "assigned" | "moved" | "checkin" | "checkout" | "charge" | "payment" | "cancel" }
export type StayState = "booked" | "assigned" | "in_house" | "departed" | "cancelled";

/**
 * The unified Reservation view (spec §3.2) — one record, two phases. Three zones from a single shared
 * reservation: the COMMERCIAL origin (read-only, written by the CRS/channel), the OPERATIONAL state
 * (PMS-owned: room, stay state, folio, housekeeping), and the TIMELINE (history of the stay). No
 * side effects — the folio is only read, never seeded here (that stays with the folio screen).
 */
export async function getReservationDetail(reservationId: string) {
  const { session, property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: {
      guest: true,
      channel: { select: { name: true } },
      bookingSource: { select: { name: true } },
      lines: { include: { roomType: { select: { name: true, maxGuests: true } }, ratePlan: { select: { name: true, cancellationPolicy: { select: { name: true } }, mealPlan: { select: { name: true } } } } } },
      assignments: { include: { unit: { select: { label: true, floor: true, hkStatus: true } } }, orderBy: { createdAt: "asc" } },
      stayGuests: { orderBy: { registerNo: "asc" } },
      folios: { include: { lines: { orderBy: { postedAt: "asc" } } }, orderBy: [{ isPrimary: "desc" }, { openedAt: "asc" }] },
    },
  });
  if (!r) return null;
  const primaryFolio = r.folios.find((f) => f.isPrimary) ?? r.folios[0] ?? null;
  const allFolioLines = r.folios.flatMap((f) => f.lines);

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const nights = ci && co ? Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86_400_000)) : 0;
  const rooms = r.lines.reduce((n, l) => n + l.quantity, 0);
  const guests = r.lines.reduce((n, l) => n + (l.guestsCount ?? 0), 0);

  const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
  const assignedUnits = active.map((a) => ({ assignmentId: a.id, label: a.unit.label, floor: a.unit.floor, hkStatus: a.unit.hkStatus as HkStatus }));
  const checkedIn = active.some((a) => a.checkedInAt != null);
  const departedToday = r.assignments.some((a) => a.checkedOutAt != null && ymd(a.checkedOutAt) === today);
  // `departedAt` is checked BEFORE occupancy and it is checked without reference to today. Both
  // matter, and both were wrong here: a stay that departed yesterday fell through every branch to
  // "booked" (it had no live assignment and had not departed *today*), and a departed stay carrying
  // a stray live assignment read "in_house" — which is the header that told a receptionist a guest
  // who had left was still in the building.
  const stayState: StayState =
    r.status === "cancelled" ? "cancelled"
      : r.departedAt != null || departedToday ? "departed"
      : checkedIn ? "in_house"
      : active.length > 0 ? "assigned"
      : "booked";

  const balance = r.folios.length > 0 ? folioBalance(allFolioLines) : null;

  // Timeline — booking → assigned → checked in → moved → charges → checked out (spec §3.2).
  const events: TimelineEvent[] = [
    { at: r.importedAt, label: "Booking received", detail: `${r.channel?.name ?? r.bookingSource?.name ?? "Direct"}${r.externalId ? ` · #${r.externalId}` : ""}`, kind: "booking" },
  ];
  for (const a of r.assignments) {
    const moved = a.note?.startsWith("moved from") ?? false;
    events.push({ at: a.createdAt, label: moved ? `Moved to room ${a.unit.label}` : `Room ${a.unit.label} assigned`, detail: a.note ?? undefined, kind: moved ? "moved" : "assigned" });
    if (a.checkedInAt) events.push({ at: a.checkedInAt, label: `Checked in — room ${a.unit.label}`, kind: "checkin" });
    if (a.checkedOutAt) events.push({ at: a.checkedOutAt, label: `Checked out — room ${a.unit.label}`, kind: "checkout" });
  }
  for (const l of allFolioLines) {
    if (l.voided) continue;
    events.push({ at: l.postedAt, label: l.kind === "payment" ? "Payment recorded" : "Charge posted", detail: l.description, kind: l.kind === "payment" ? "payment" : "charge" });
  }
  if (r.cancelledAt) events.push({ at: r.cancelledAt, label: "Cancelled", kind: "cancel" });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    property,
    reservationId: r.id,
    guestName,
    status: r.status,
    commercial: {
      source: r.channel?.name ?? r.bookingSource?.name ?? "Direct",
      externalId: r.externalId,
      ratePlans: [...new Set(r.lines.map((l) => l.ratePlan.name))],
      roomTypes: [...new Set(r.lines.map((l) => l.roomType.name))],
      mealPlan: r.lines.map((l) => l.ratePlan.mealPlan?.name).find(Boolean) ?? null,
      cancellation: r.lines.map((l) => l.ratePlan.cancellationPolicy?.name).find(Boolean) ?? null,
      paymentGuarantee: r.paymentGuarantee,
      totalMinor: r.propertyTotalMinor ?? r.totalMinor,
      currency: r.propertyCurrency ?? r.currency,
      checkIn: ci ? ymd(ci) : null,
      checkOut: co ? ymd(co) : null,
      nights, rooms, guests,
      notes: r.notes,
    },
    operational: {
      /**
       * The stay's own lines, so the guest count can be corrected here (OBP §5.4).
       *
       * A party that arrives as three when the booking said two changes the price under a
       * per-person plan, and the correction has to happen where the receptionist is standing —
       * not by cancelling and rebooking.
       */
      /**
       * Регистър на настанените туристи (чл. 116 ЗТ) — the people accommodated on this stay.
       *
       * Dates are NOT stored on the row: arrival, departure and the night count are the stay's, and
       * a register that kept its own copy would disagree with the folio the first time a departure
       * moved. The room IS stored, because that is a fact about the night rather than about the
       * booking, and a move next season must not rewrite it.
       */
      register: r.stayGuests.map((g) => ({
        id: g.id,
        registerNo: g.registerNo,
        registeredAt: ymd(g.registeredAt),
        fullName: g.fullName,
        personalId: g.personalId,
        dateOfBirth: g.dateOfBirth ? ymd(g.dateOfBirth) : null,
        sex: g.sex as "m" | "f" | null,
        nationality: g.nationality ?? "",
        documentNumber: g.documentNumber,
        documentSeries: g.documentSeries,
        documentCountry: g.documentCountry,
        unitLabel: g.unitLabel,
        floor: g.floor,
        arrivalDate: ci ? ymd(ci) : "",
        departureDate: r.departedAt ? ymd(r.departedAt) : co ? ymd(co) : null,
        nights,
        touristPackage: g.touristPackage,
      })),
      stayLines: r.lines.map((l) => ({
        id: l.id,
        roomTypeName: l.roomType.name,
        guestsCount: l.guestsCount,
        maxGuests: l.roomType.maxGuests,
      })),
      stayState,
      departedAt: r.departedAt,
      dueOut: co ? ymd(co) === today : false,
      assignedUnits,
      folioId: primaryFolio?.id ?? null,
      folioCount: r.folios.length,
      balance,
      currency: primaryFolio?.currency ?? r.currency,
    },
    // Reopening a stay is manager-only, so the screen needs to know whether to offer it.
    isManager: MANAGER_ROLES.has(session.role),
    events,
  };
}

/** In-house stays with their folio balance, for the /folios list. */
export async function listFolios() {
  const { property } = await activeProperty();
  const assignments = await prisma.roomAssignment.findMany({
    // Both filters are load-bearing, not defensive. This list is titled "live bills for in-house
    // guests" but was derived purely from assignment rows, so anything holding a stale assignment
    // appeared in the one list a receptionist trusts to mean "still in the house":
    //   departedAt — a departed stay that had been checked in a second time (the round-2 bug), shown
    //     here with its already-closed folio's balance;
    //   status — a CANCELLED reservation, found live at €393. The CRS now refuses to cancel an
    //     in-house stay, but an OTA can cancel a booking for a guest who has already arrived, and
    //     that is a fact arriving from outside rather than an action we can refuse. When it happens
    //     the row must not read as a live bill.
    where: {
      propertyId: property.id,
      status: "active",
      checkedOutAt: null,
      // Arrived. A folio opens at check-in, so an auto-assigned future booking has no bill to show
      // and listing it would put tomorrow's guests in today's work.
      checkedInAt: { not: null },
      reservation: { departedAt: null, status: { notIn: ["cancelled"] } },
    },
    include: { reservation: { include: { guest: true, folios: { include: { lines: true } } } }, unit: { select: { label: true } } },
    orderBy: { checkedInAt: "desc" },
  });

  const byRes = new Map<string, { reservationId: string; guestName: string; units: string[]; balance: number | null; currency: string; folioCount: number }>();
  for (const a of assignments) {
    const r = a.reservation;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const balance = r.folios.length > 0 ? r.folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0) : null;
    const row = byRes.get(r.id) ?? {
      reservationId: r.id, guestName, units: [],
      balance,
      currency: r.folios[0]?.currency ?? r.currency ?? property.baseCurrency,
      folioCount: r.folios.length,
    };
    row.units.push(a.unit.label);
    byRes.set(r.id, row);
  }
  return { property, rows: [...byRes.values()] };
}

export type HistoryRow = {
  reservationId: string;
  guestName: string;
  externalId: string | null;
  units: string[];
  checkIn: string | null;
  checkOut: string | null;
  balanceMinor: number | null;
  currency: string;
  settled: boolean; // balance resolved (0) — the financial record is clean
  closed: boolean; // every folio closed
  invoiceNumbers: string[];
};

/**
 * Folio HISTORY (PMS-REFINEMENT-R1 §4.1/§4.2): the read-only financial archive — departed stays with
 * their folios + issued invoices, searchable. Distinct from the Open list (in-house, live). Never an
 * editing surface (§4.6 lock-on-settlement). Search matches guest name, reservation number, or invoice
 * number.
 */
export interface ReceivableRow {
  folioId: string;
  reservationId: string;
  guestName: string;
  label: string;
  balance: number;
  currency: string;
  closedAt: Date | null;
  /** Days since the folio closed — aged debt reads as an age, not a date to subtract in your head. */
  ageDays: number;
}

/**
 * Money owed by guests who have already left: folios closed carrying a balance (§1.5).
 *
 * This view is what makes "closed — outstanding" a managed state instead of limbo. Before it, a
 * check-out with an override produced a closed folio with a red balance that appeared in the OPEN
 * list, so the debt was simultaneously invisible as a receivable and misleading as a live bill.
 * Aged debt is a set to work through, not something to rediscover one folio at a time.
 */
export async function listReceivables(): Promise<{
  property: Awaited<ReturnType<typeof activeProperty>>["property"];
  rows: ReceivableRow[];
  totalMinor: number;
}> {
  const { property } = await activeProperty();
  const folios = await prisma.folio.findMany({
    where: { propertyId: property.id, status: "closed", outcome: "outstanding" },
    include: {
      lines: { select: { kind: true, amountMinor: true, voided: true } },
      reservation: { select: { id: true, guestName: true, guest: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { closedAt: "asc" }, // oldest debt first — that is the one that needs chasing
  });

  const now = Date.now();
  const rows: ReceivableRow[] = [];
  for (const f of folios) {
    const balance = folioBalance(f.lines).balance;
    // A folio marked outstanding whose balance has since reached zero (a payment was posted against
    // it after the fact) is no longer a receivable. Show what is true now rather than what was true
    // at close.
    if (balance === 0) continue;
    const r = f.reservation;
    rows.push({
      folioId: f.id,
      reservationId: r.id,
      guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName,
      label: f.label,
      balance,
      currency: f.currency,
      closedAt: f.closedAt,
      ageDays: f.closedAt ? Math.floor((now - f.closedAt.getTime()) / 86_400_000) : 0,
    });
  }
  return { property, rows, totalMinor: rows.reduce((s, r) => s + r.balance, 0) };
}

export async function listFolioHistory(q?: string): Promise<{ property: Awaited<ReturnType<typeof activeProperty>>["property"]; rows: HistoryRow[] }> {
  const { property } = await activeProperty();
  // A departed stay = a reservation with at least one checked-out assignment here.
  const departed = await prisma.roomAssignment.findMany({
    where: { propertyId: property.id, checkedOutAt: { not: null } },
    include: {
      unit: { select: { label: true } },
      reservation: { include: { guest: true, folios: { include: { lines: true } } } },
    },
    orderBy: { checkedOutAt: "desc" },
  });

  const resIds = [...new Set(departed.map((a) => a.reservationId))];
  const invoices = resIds.length
    ? await prisma.taxInvoice.findMany({ where: { reservationId: { in: resIds } }, select: { reservationId: true, number: true } })
    : [];
  const invByRes = new Map<string, string[]>();
  for (const inv of invoices) invByRes.set(inv.reservationId, [...(invByRes.get(inv.reservationId) ?? []), inv.number]);

  const byRes = new Map<string, HistoryRow>();
  for (const a of departed) {
    const r = a.reservation;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const row = byRes.get(r.id) ?? {
      reservationId: r.id,
      guestName,
      externalId: r.externalId,
      units: [],
      checkIn: null,
      checkOut: null,
      balanceMinor: r.folios.length ? r.folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0) : null,
      currency: r.folios[0]?.currency ?? r.currency ?? property.baseCurrency,
      settled: r.folios.length ? r.folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0) === 0 : false,
      closed: r.folios.length > 0 && r.folios.every((f) => f.status === "closed"),
      invoiceNumbers: invByRes.get(r.id) ?? [],
    };
    if (!row.units.includes(a.unit.label)) row.units.push(a.unit.label);
    const ci = ymd(a.checkIn), co = ymd(a.checkOut);
    if (!row.checkIn || ci < row.checkIn) row.checkIn = ci;
    if (!row.checkOut || co > row.checkOut) row.checkOut = co;
    byRes.set(r.id, row);
  }

  let rows = [...byRes.values()];
  const needle = q?.trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (r) =>
        r.guestName.toLowerCase().includes(needle) ||
        (r.externalId ?? "").toLowerCase().includes(needle) ||
        r.reservationId.toLowerCase().includes(needle) ||
        r.invoiceNumbers.some((n) => n.toLowerCase().includes(needle)),
    );
  }
  return { property, rows };
}

/**
 * Accrue every in-house stay's recurring extras for one night (spec §3.6) — "breakfast for the whole
 * stay" posts one folio line per night at the night audit, separate from one-off POS. IDEMPOTENT: each
 * line carries ref `stayextra:<id>:<date>`, so re-running Close Day never double-charges a night.
 * Returns how many lines were posted.
 */
export async function accrueStayExtras(tenantId: string, propertyId: string, businessDate: string, db: typeof prisma = prisma): Promise<number> {
  /*
   * THIS is the accrual clock — the write, not the report.
   *
   * It used to ask only "is there a live assignment row?", and that is how a guest who checked out
   * on 9 July was charged breakfast on 22 July: a second check-in had left a live row behind, and
   * every night audit since had faithfully billed it. Excluding departed and cancelled stays here
   * is what actually stops the charges; the equivalent filter on the night-audit REPORT only stops
   * them being counted.
   */
  const inHouse = await db.roomAssignment.findMany({
    where: {
      propertyId, status: "active", checkedOutAt: null, checkedInAt: { not: null },
      reservation: { departedAt: null, status: { notIn: ["cancelled", "no_show"] } },
    },
    select: { reservationId: true },
  });
  const reservationIds = [...new Set(inHouse.map((a) => a.reservationId))];
  if (reservationIds.length === 0) return 0;

  const extras = await db.stayExtra.findMany({ where: { propertyId, active: true, reservationId: { in: reservationIds } } });
  let posted = 0;
  for (const e of extras) {
    /*
     * A per-STAY extra posts once; a per-NIGHT extra posts on every night audit.
     *
     * The whole implementation is the ref. It was already the idempotency key — "have we accrued
     * this extra for this date?" — so dropping the date for a per-stay extra turns that same guard
     * into "have we accrued this extra at all?". An airport transfer chosen at booking is charged
     * once however long the guest stays, and no second code path exists to get that wrong.
     */
    const perStay = e.basis === "per_stay";
    const ref = perStay ? `stayextra:${e.id}:once` : `stayextra:${e.id}:${businessDate}`;
    if (await db.folioLine.findFirst({ where: { ref }, select: { id: true } })) continue; // already accrued
    const folioId = await ensureFolio(tenantId, propertyId, e.reservationId, db);
    if (!folioId) continue;
    // A closed folio takes no more charges. `postFolioLine` throws on one, and a night audit sweeping
    // the whole house must not abort because a single stay's bill is already settled — so check and
    // skip here, and let the throw stay as the backstop for callers that should never meet one.
    const folio = await db.folio.findUnique({ where: { id: folioId }, select: { status: true } });
    if (!folio || folio.status !== "open") continue;
    await postFolioLineWith(db, {
      tenantId, propertyId, folioId, kind: "extra", outlet: "extra",
      description: perStay ? e.name : `${e.name} · ${businessDate}`, amountMinor: e.priceMinor, ref,
    });
    posted++;
  }
  return posted;
}

/** Add a labelled split/company folio to a stay (spec §3.6). */
export async function createSplitFolio(tenantId: string, propertyId: string, reservationId: string, label: string): Promise<string | null> {
  const primary = await prisma.folio.findFirst({ where: { reservationId, propertyId }, select: { currency: true } });
  if (!primary) return null;
  const f = await prisma.folio.create({ data: { tenantId, propertyId, reservationId, currency: primary.currency, isPrimary: false, label: label || "Split" }, select: { id: true } });
  return f.id;
}

/**
 * How closed folios ended, in totals — J1 (§1.4).
 *
 * The verification that prompted this found that `written_off` and `paid_offsystem` could not be
 * conflated (a write-off posts no folio line, so nothing summing payments can count it as income) and
 * were also **not reported anywhere at all** — an owner could not answer "how much did we write off
 * last month" without opening folios one at a time. See `folio-outcomes.ts`.
 *
 * Windowed on `closedAt`, not `openedAt`: the question is about the month the money was resolved in,
 * which is when the decision was taken, not when the guest arrived.
 */
export async function folioOutcomeSummary(sinceDays = 90): Promise<{
  totals: OutcomeTotal[];
  headline: ReturnType<typeof outcomeHeadline>;
  sinceDays: number;
}> {
  const { property } = await activeProperty();
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  const folios = await prisma.folio.findMany({
    where: { propertyId: property.id, status: "closed", closedAt: { gte: since } },
    select: { outcome: true, lines: { select: { kind: true, amountMinor: true, voided: true } } },
  });

  const rows = folios.map((f) => ({
    outcome: f.outcome,
    // What the folio was WORTH — the charges, not the balance. A settled folio has a zero balance
    // and is not therefore worth nothing; the revenue it represents is the charges on it.
    grossMinor: f.lines
      .filter((l) => !l.voided && l.kind !== "payment" && !l.kind.startsWith("deposit_"))
      .reduce((s, l) => s + l.amountMinor, 0),
  }));

  const totals = summariseOutcomes(rows);
  return { totals, headline: outcomeHeadline(totals), sinceDays };
}
