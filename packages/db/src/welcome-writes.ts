import { todayInTimeZone } from "@revio/core";
import { withTenantTransaction } from "./rls.js";

/**
 * The first-run flow's shared writes — one definition, three products.
 *
 * ## Why these moved here
 *
 * `welcome-facts.ts` next door is the READ half of first-run and has always been shared. The WRITE
 * half was copied into RevioLink, RevioCRS and RevioPMS, and on 2026-09-23 the copies were compared:
 *
 *   * RevioLink and RevioCRS were identical line for line in their code, and their comments said so
 *     ("the same fix as RevioLink's, for the same reason") — two bugs, the unpriced second and third
 *     rate plans and the missing occupancy that put "—" on every calendar cell, had each been fixed
 *     twice.
 *   * RevioPMS's room-type step had already lost something: it created the room type and never
 *     linked it to the property's rate plans. A hotel that starts on the PMS and adds RevioCRS or
 *     RevioLink later finds room types no plan can sell — exactly the "second copy loses something"
 *     the UI standard warns about.
 *
 * So the writes are here, and each app keeps only what is genuinely its own: who may do it, which
 * screen comes next, and which of its paths to revalidate.
 *
 * ## Shape
 *
 * Plain inputs in (the raw form strings — parsing is part of the rule, and it was copied too),
 * `{ error }` out in the hotel's words. Each write is ONE transaction: a room type created and then
 * a failed plan link would leave exactly the unsellable room this module exists to prevent.
 */

export type WelcomeWrite = { error?: string };

interface Scope {
  tenantId: string;
  propertyId: string;
}

export interface PropertyDetailsInput {
  name: string;
  address: string;
  contactEmail: string;
  phone: string;
  timezone: string;
  baseCurrency: string;
  checkInTime: string;
  checkOutTime: string;
}

/** Step 1 — who and where they are. The address and contact email print on every guest document. */
export async function writeWelcomeProperty(scope: Scope, input: PropertyDetailsInput): Promise<WelcomeWrite> {
  const name = input.name.trim();
  if (!name) return { error: "Your property needs a name." };
  const contactEmail = input.contactEmail.trim();
  if (contactEmail && !contactEmail.includes("@")) return { error: "That contact email doesn't look right." };

  await withTenantTransaction(scope.tenantId, (tx) =>
    tx.property.update({
      where: { id: scope.propertyId },
      data: {
        name,
        address: input.address.trim() || null,
        contactEmail: contactEmail || null,
        phone: input.phone.trim() || null,
        timezone: input.timezone || "Europe/Sofia",
        baseCurrency: input.baseCurrency || "EUR",
        checkInTime: input.checkInTime || "14:00",
        checkOutTime: input.checkOutTime || "12:00",
      },
    }),
  );
  return {};
}

/**
 * Step 2 — a room type, and with it the property's size.
 *
 * Linked to every existing rate plan in the same transaction — the rule the Rooms & Rates screen
 * follows, so a room type is sellable the moment it exists, whichever product created it.
 */
export async function writeWelcomeRoomType(
  scope: Scope,
  input: { name: string; totalRooms: string; maxGuests: string },
): Promise<WelcomeWrite> {
  const name = input.name.trim();
  const rooms = Number.parseInt(input.totalRooms, 10);
  const guests = Number.parseInt(input.maxGuests, 10);
  if (!name) return { error: "Give the room type a name — “Double Room” is fine." };
  if (!Number.isFinite(rooms) || rooms < 1) return { error: "How many of these rooms do you have?" };
  if (!Number.isFinite(guests) || guests < 1) return { error: "How many guests fit in one?" };

  await withTenantTransaction(scope.tenantId, async (tx) => {
    // A code is what OTAs key on. Derived rather than asked — nobody buying hotel software wants to
    // invent one — and editable later in Rooms & Rates.
    const base = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "RM";
    const taken = await tx.roomType.findMany({ where: { propertyId: scope.propertyId }, select: { code: true } });
    const codes = new Set(taken.map((t) => t.code));
    let code = base;
    for (let n = 2; codes.has(code); n++) code = `${base}${n}`;

    const created = await tx.roomType.create({
      data: {
        tenantId: scope.tenantId, propertyId: scope.propertyId,
        name, code, totalRooms: rooms, maxGuests: guests, sortOrder: taken.length,
      },
    });
    const plans = await tx.ratePlan.findMany({ where: { propertyId: scope.propertyId }, select: { id: true } });
    if (plans.length) {
      await tx.ratePlanRoomType.createMany({ data: plans.map((p) => ({ ratePlanId: p.id, roomTypeId: created.id })) });
    }
  });
  return {};
}

/**
 * Step 3 — one nightly price for every sellable plan, across a season.
 *
 * **Every** active manual plan, not the first: the first real hotel (2026-09-09) came out of
 * onboarding with three active plans and at most one priced; the other two were live, linked to
 * every room and unsellable, with nothing on any screen saying so. Derived plans follow their parent
 * by definition and are left alone.
 *
 * ⚠️ Occupancy on every row. `RatePrice` is keyed by (room, plan, date, occupancy) since OBP; rows
 * written without it matched no lookup and a brand-new hotel saw "—" on every calendar cell. Written
 * at the room's ceiling — the one-row-per-room shape.
 *
 * ⚠️ From the PROPERTY'S today. Both copies started at the server's UTC date, which for a Bulgarian
 * hotel onboarding before 03:00 priced yesterday and left the season's last night empty.
 *
 * `rateScreen` is where the hotel adds a plan in THIS product — the one line that differs.
 */
export async function writeWelcomePrice(
  scope: Scope & { timezone: string },
  input: { price: string; rateScreen: string },
): Promise<WelcomeWrite> {
  const major = Number.parseFloat(input.price.replace(",", "."));
  if (!Number.isFinite(major) || major <= 0) return { error: "Enter a nightly price." };
  const priceMinor = Math.round(major * 100);

  // 180 days is a season, not the full 500-day horizon: sellable today, and a number typed in thirty
  // seconds is not committed two years out.
  const DAYS = 180;
  const [y, m, d] = todayInTimeZone(scope.timezone).split("-").map(Number) as [number, number, number];

  return withTenantTransaction(scope.tenantId, async (tx): Promise<WelcomeWrite> => {
    const plans = await tx.ratePlan.findMany({
      where: { propertyId: scope.propertyId, active: true, priceLogic: "manual" },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    const roomTypes = await tx.roomType.findMany({ where: { propertyId: scope.propertyId }, select: { id: true, maxGuests: true } });
    // Two causes, two messages: "add a room type" in front of somebody with three room types and no
    // active plan sends them to the wrong screen.
    if (roomTypes.length === 0) return { error: "Add a room type first — a price belongs to a room." };
    if (plans.length === 0) {
      return { error: `There is no active rate plan to price. Add one in ${input.rateScreen}, then come back — a price has to live on a plan.` };
    }

    const rows = plans.flatMap((plan) =>
      roomTypes.flatMap((rt) =>
        Array.from({ length: DAYS }, (_, i) => ({
          tenantId: scope.tenantId, propertyId: scope.propertyId, ratePlanId: plan.id, roomTypeId: rt.id,
          date: new Date(Date.UTC(y, m - 1, d + i)), occupancy: Math.max(1, rt.maxGuests), priceMinor,
        })),
      ),
    );
    // Never overwrites a price somebody has since edited on the calendar — which means it can write
    // nothing, and "saved" for that would be a lie.
    const written = await tx.ratePrice.createMany({ data: rows, skipDuplicates: true });
    if (written.count === 0) {
      // Checked BEFORE the plan defaults move: both copies updated the defaults and then said
      // "nothing was changed".
      return { error: "Those dates already have prices, so nothing was changed. Edit them on the calendar or in Bulk update." };
    }

    // Each plan's own default, so a date beyond the season still resolves to a number.
    for (const plan of plans) {
      for (const occupancy of new Set(roomTypes.map((rt) => Math.max(1, rt.maxGuests)))) {
        await tx.ratePlanOccupancy.upsert({
          where: { ratePlanId_occupancy: { ratePlanId: plan.id, occupancy } },
          create: { tenantId: scope.tenantId, ratePlanId: plan.id, occupancy, isPrimary: true, mode: "manual", rateMinor: priceMinor, rounding: "none" },
          update: { rateMinor: priceMinor },
        });
      }
    }
    return {};
  });
}

/**
 * The tax & invoicing step (RevioCRS and RevioPMS — the products that issue documents).
 *
 * The invoice identity was asked on no screen in any product until P2, so a hotel could issue a tax
 * document with no VAT number. City tax is a `TaxFee` row, not a column: updated in place on a second
 * pass, and deactivated rather than deleted when cleared, because a fee already charged on a folio
 * must keep existing for that folio to explain itself.
 */
export async function writeWelcomeTaxes(
  scope: Scope,
  input: {
    vatStandardPct: string; vatReducedPct: string; cityTax: string;
    invoiceIssuerName: string; invoiceVatId: string; invoiceAddress: string;
  },
): Promise<WelcomeWrite> {
  const standard = Number.parseInt(input.vatStandardPct, 10);
  const reduced = Number.parseInt(input.vatReducedPct, 10);
  if (!Number.isFinite(standard) || standard < 0 || standard > 100) return { error: "VAT must be between 0 and 100." };
  if (!Number.isFinite(reduced) || reduced < 0 || reduced > 100) return { error: "VAT must be between 0 and 100." };

  const cityTaxRaw = input.cityTax.trim().replace(",", ".");
  let cityTaxMinor: number | null = null;
  if (cityTaxRaw) {
    const major = Number.parseFloat(cityTaxRaw);
    if (!Number.isFinite(major) || major < 0) return { error: "City tax must be a number, or left empty." };
    cityTaxMinor = Math.round(major * 100);
  }

  const invoice = {
    invoiceIssuerName: input.invoiceIssuerName.trim() || null,
    invoiceVatId: input.invoiceVatId.trim() || null,
    invoiceAddress: input.invoiceAddress.trim() || null,
  };

  await withTenantTransaction(scope.tenantId, async (tx) => {
    await tx.propertyDefaults.upsert({
      where: { propertyId: scope.propertyId },
      create: { tenantId: scope.tenantId, propertyId: scope.propertyId, vatStandardPct: standard, vatReducedPct: reduced, ...invoice },
      update: { vatStandardPct: standard, vatReducedPct: reduced, ...invoice },
    });
    const existing = await tx.taxFee.findFirst({
      where: { propertyId: scope.propertyId, basis: "per_person", type: "fixed", active: true },
    });
    if (cityTaxMinor != null && cityTaxMinor > 0) {
      if (existing) {
        await tx.taxFee.update({ where: { id: existing.id }, data: { amountMinor: cityTaxMinor } });
      } else {
        await tx.taxFee.create({
          data: {
            tenantId: scope.tenantId, propertyId: scope.propertyId, name: "City tax",
            type: "fixed", amountMinor: cityTaxMinor, basis: "per_person", inclusion: "excluded",
          },
        });
      }
    } else if (existing) {
      await tx.taxFee.update({ where: { id: existing.id }, data: { active: false } });
    }
  });
  return {};
}
