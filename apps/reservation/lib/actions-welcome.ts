"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SETUP_KEY, hasFinishedSetup, nextStep, welcomeFlow } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getProperty } from "./data";
import { getWelcomeFactsForProperty } from "./welcome";
import { str } from "./mutation-helpers";
import { guard, requireCapability } from "./authz";
import { markBillable } from "@revio/db";

/**
 * RevioCRS's first-run writes.
 *
 * Deliberately thin — each screen collects the least it can and hands off to the normal screens once
 * setup ends. The one thing this app asks that RevioLink does not is tax and invoicing, because the
 * CRS is where a booking becomes a document somebody has to be able to file.
 */

export type WelcomeResult = { error?: string };

const PRODUCT = "RevioCRS";

async function advance(from: string): Promise<never> {
  const facts = await getWelcomeFactsForProperty();
  const next = nextStep(welcomeFlow(PRODUCT, facts), from);
  redirect(next ? `/welcome/${next.key}` : "/dashboard");
}

/** Step 1 — who and where they are. The address and contact email print on guest confirmations. */
export async function saveWelcomeProperty(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };

  const name = str(fd, "name").trim();
  if (!name) return { error: "Your property needs a name." };

  const contactEmail = str(fd, "contactEmail").trim();
  if (contactEmail && !contactEmail.includes("@")) {
    return { error: "That contact email doesn't look right." };
  }

  await prisma.property.update({
    where: { id: session.activePropertyId },
    data: {
      name,
      address: str(fd, "address").trim() || null,
      contactEmail: contactEmail || null,
      phone: str(fd, "phone").trim() || null,
      timezone: str(fd, "timezone") || "Europe/Sofia",
      baseCurrency: str(fd, "baseCurrency") || "EUR",
      checkInTime: str(fd, "checkInTime") || "14:00",
      checkOutTime: str(fd, "checkOutTime") || "12:00",
    },
  });

  return advance("property");
}

/** Step 2 — the room types, and with them the property's size. */
export async function addWelcomeRoomType(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };
  const property = await getProperty();

  const name = str(fd, "name").trim();
  const rooms = Number.parseInt(str(fd, "totalRooms"), 10);
  const guests = Number.parseInt(str(fd, "maxGuests"), 10);

  if (!name) return { error: "Give the room type a name — “Double Room” is fine." };
  if (!Number.isFinite(rooms) || rooms < 1) return { error: "How many of these rooms do you have?" };
  if (!Number.isFinite(guests) || guests < 1) return { error: "How many guests fit in one?" };

  // Derived rather than asked — a code is an OTA concern, and it stays editable in Rooms & Rates.
  const base = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "RM";
  const taken = await prisma.roomType.findMany({ where: { propertyId: property.id }, select: { code: true } });
  const codes = new Set(taken.map((t) => t.code));
  let code = base;
  for (let n = 2; codes.has(code); n++) code = `${base}${n}`;

  const count = await prisma.roomType.count({ where: { propertyId: property.id } });
  const created = await prisma.roomType.create({
    data: {
      tenantId: session.tenantId,
      propertyId: property.id,
      name,
      code,
      totalRooms: rooms,
      maxGuests: guests,
      sortOrder: count,
    },
  });

  const plans = await prisma.ratePlan.findMany({ where: { propertyId: property.id }, select: { id: true } });
  if (plans.length) {
    await prisma.ratePlanRoomType.createMany({
      data: plans.map((p) => ({ ratePlanId: p.id, roomTypeId: created.id })),
    });
  }

  revalidatePath("/welcome/rooms");
  return {};
}

export async function removeWelcomeRoomType(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const rt = await prisma.roomType.findUnique({ where: { id: str(fd, "id") } });
  if (!rt || rt.propertyId !== property.id) return;
  await prisma.roomType.delete({ where: { id: rt.id } });
  revalidatePath("/welcome/rooms");
}

export async function finishWelcomeRooms(): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const count = await prisma.roomType.count({ where: { propertyId: property.id } });
  if (count === 0) return;
  await advance("rooms");
}

/**
 * Step 3 — one price across the priced horizon. Empty by default: this is the hotel's revenue, and a
 * prefilled rate is the one default that costs them money.
 */
export async function setWelcomePrice(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };
  const property = await getProperty();

  const major = Number.parseFloat(str(fd, "price").replace(",", "."));
  if (!Number.isFinite(major) || major <= 0) return { error: "Enter a nightly price." };
  const priceMinor = Math.round(major * 100);

  /*
   * EVERY sellable plan, not just the first — the same fix as RevioLink's, for the same reason.
   *
   * The first real hotel came out of onboarding with three active manual plans and at most one of
   * them priced. The other two were live, linked to every room, and unsellable, with nothing on any
   * screen saying so. A plan that is active and manual must have a price or it cannot sell.
   *
   * Derived plans are excluded: they follow their parent by definition, and pricing one directly is
   * overwritten the moment the parent moves.
   */
  const plans = await prisma.ratePlan.findMany({
    where: { propertyId: property.id, active: true, priceLogic: "manual" },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  /*
   * ⚠️ Occupancy is REQUIRED on every write, and this is where that was missed.
   *
   * `RatePrice` is keyed by (room, plan, date, occupancy) since OBP. These rows were written with no
   * occupancy at all, which meant a brand-new hotel finished onboarding, set a price, and saw "—"
   * on every calendar cell: `resolveRate` looks up a specific occupancy and a NULL row matches
   * nothing. Worse, NULL is not equal to itself in a unique index, so `skipDuplicates` would not
   * even dedupe a second run.
   *
   * Written at the room's ceiling — the one-row per-room shape, and where the migration backfilled
   * every existing row.
   */
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    select: { id: true, maxGuests: true, defaultOccupancy: true },
  });
  // Two causes, two messages. "Add a room type first" in front of somebody who has three room types
  // and no active rate plan sends them to the wrong screen.
  if (roomTypes.length === 0) return { error: "Add a room type first — a price belongs to a room." };
  if (plans.length === 0) {
    return { error: "There is no active rate plan to price. Add one in Rates & Restrictions, then come back — a price has to live on a plan." };
  }

  const DAYS = 180;
  const today = new Date();
  const rows: {
    tenantId: string; propertyId: string; ratePlanId: string; roomTypeId: string;
    date: Date; occupancy: number; priceMinor: number;
  }[] = [];
  for (const plan of plans) {
    for (const rt of roomTypes) {
      const occupancy = Math.max(1, rt.maxGuests);
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + d));
        rows.push({
          tenantId: session.tenantId,
          propertyId: property.id,
          ratePlanId: plan.id,
          roomTypeId: rt.id,
          date,
          occupancy,
          priceMinor,
        });
      }
    }
  }
  // Safe to re-run — it never overwrites a price somebody has since edited. Which means it can write
  // nothing, and reporting "saved" for that would be the silence this project keeps being bitten by.
  const written = await prisma.ratePrice.createMany({ data: rows, skipDuplicates: true });

  /*
   * And the plan needs its occupancy option, or it has no default price to fall back on.
   *
   * A plan created by provisioning has none — the H13 backfill only covered plans that existed when
   * it ran. Without this a date outside the 180-night window prices as null rather than falling back
   * to the plan's own rate.
   */
  for (const plan of plans) {
    for (const rt of roomTypes) {
      const occupancy = Math.max(1, rt.maxGuests);
      await prisma.ratePlanOccupancy.upsert({
        where: { ratePlanId_occupancy: { ratePlanId: plan.id, occupancy } },
        create: {
          tenantId: session.tenantId, ratePlanId: plan.id, occupancy,
          isPrimary: true, mode: "manual", rateMinor: priceMinor, rounding: "none",
        },
        update: { rateMinor: priceMinor },
      });
    }
  }

  if (written.count === 0 && rows.length > 0) {
    // Every date already had a price. Nothing is wrong, but "saved" would be a lie.
    return { error: "Those dates already have prices, so nothing was changed. Edit them on the calendar or in Bulk update." };
  }

  revalidatePath("/calendar");
  return advance("prices");
}

/**
 * Tax and invoicing — the step that was missing entirely.
 *
 * A hotel could previously finish setup, take a booking and issue a tax document carrying no VAT
 * number, because `invoiceIssuerName` / `invoiceVatId` / `invoiceAddress` were asked on no screen in
 * any product. The VAT rates are shown with jurisdiction defaults rather than assumed silently: they
 * are money fields, and money is never decided by us on their behalf.
 */
export async function saveWelcomeTaxes(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };
  const property = await getProperty();

  const standard = Number.parseInt(str(fd, "vatStandardPct"), 10);
  const reduced = Number.parseInt(str(fd, "vatReducedPct"), 10);
  if (!Number.isFinite(standard) || standard < 0 || standard > 100) return { error: "VAT must be between 0 and 100." };
  if (!Number.isFinite(reduced) || reduced < 0 || reduced > 100) return { error: "VAT must be between 0 and 100." };

  const cityTaxRaw = str(fd, "cityTax").trim().replace(",", ".");
  let cityTaxMinor: number | null = null;
  if (cityTaxRaw) {
    const major = Number.parseFloat(cityTaxRaw);
    if (!Number.isFinite(major) || major < 0) return { error: "City tax must be a number, or left empty." };
    cityTaxMinor = Math.round(major * 100);
  }

  await prisma.propertyDefaults.upsert({
    where: { propertyId: property.id },
    create: {
      tenantId: session.tenantId,
      propertyId: property.id,
      vatStandardPct: standard,
      vatReducedPct: reduced,
      invoiceIssuerName: str(fd, "invoiceIssuerName").trim() || null,
      invoiceVatId: str(fd, "invoiceVatId").trim() || null,
      invoiceAddress: str(fd, "invoiceAddress").trim() || null,
    },
    update: {
      vatStandardPct: standard,
      vatReducedPct: reduced,
      invoiceIssuerName: str(fd, "invoiceIssuerName").trim() || null,
      invoiceVatId: str(fd, "invoiceVatId").trim() || null,
      invoiceAddress: str(fd, "invoiceAddress").trim() || null,
    },
  });

  // City tax is a TaxFee row, not a column: a property may charge several, and the folio already
  // knows how to apply them. Updated in place rather than added again on a second pass.
  const existing = await prisma.taxFee.findFirst({
    where: { propertyId: property.id, basis: "per_person", type: "fixed", active: true },
  });
  if (cityTaxMinor != null && cityTaxMinor > 0) {
    if (existing) {
      await prisma.taxFee.update({ where: { id: existing.id }, data: { amountMinor: cityTaxMinor } });
    } else {
      await prisma.taxFee.create({
        data: {
          tenantId: session.tenantId,
          propertyId: property.id,
          name: "City tax",
          type: "fixed",
          amountMinor: cityTaxMinor,
          basis: "per_person",
          inclusion: "excluded",
        },
      });
    }
  } else if (existing) {
    // They cleared it. Deactivate rather than delete: a fee that has already been charged on a folio
    // must keep existing for that folio to still explain itself.
    await prisma.taxFee.update({ where: { id: existing.id }, data: { active: false } });
  }

  revalidatePath("/settings", "layout");
  return advance("taxes");
}

/**
 * The personalisation step — one answer, two guest-facing surfaces.
 *
 * `bookingBrandColor` is nullable and NULL means "inherit the email colour", so writing only the
 * email columns brands the hotel's own booking page as well. Writing both would freeze a copy and
 * break that inheritance permanently.
 */
export async function saveWelcomeBrand(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };

  const colour = str(fd, "emailBrandColor").trim();
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { error: "Use a colour like #0E7C86." };

  const logo = str(fd, "emailLogoUrl").trim();
  if (logo && !/^https:\/\//.test(logo)) return { error: "The logo link needs to start with https://" };

  await prisma.property.update({
    where: { id: session.activePropertyId },
    data: {
      emailSenderName: str(fd, "emailSenderName").trim() || null,
      emailBrandColor: colour || null,
      emailLogoUrl: logo || null,
    },
  });

  revalidatePath("/settings", "layout");
  return advance("brand");
}

/** Leave a step for later. It stays on the dashboard checklist, which is the point of allowing it. */
export async function skipWelcomeStep(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  await advance(str(fd, "from"));
}

/** The last screen. Records that first-run is over so the flow never reappears. */
export async function finishWelcome(): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  if (!hasFinishedSetup(property.setupCompleted, PRODUCT)) {
    await prisma.property.updateMany({
      where: { id: property.id, NOT: { setupCompleted: { has: SETUP_KEY[PRODUCT] } } },
      data: { setupCompleted: { push: SETUP_KEY[PRODUCT] } },
    });
  }
  /*
   * A client with no channel manager becomes billable here.
   *
   * The refund policy is explicit: with channel management we wait for the first synced booking;
   * without it, billing begins when the property is configured and ready. A CRS-only or PMS-only
   * hotel will never have a booking sync, so waiting for one would leave them free forever.
   *
   * `markBillable` decides which trigger applies to this tenant and ignores the wrong one, so this
   * call is safe on every product.
   */
  await markBillable(property.tenantId, "setup_completed");

  redirect("/dashboard?welcome=done");
}
