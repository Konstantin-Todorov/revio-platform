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

  const plan = await prisma.ratePlan.findFirst({
    where: { propertyId: property.id, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const roomTypes = await prisma.roomType.findMany({ where: { propertyId: property.id }, select: { id: true } });
  if (!plan || roomTypes.length === 0) return { error: "Add a room type first." };

  const DAYS = 180;
  const today = new Date();
  const rows: { tenantId: string; propertyId: string; ratePlanId: string; roomTypeId: string; date: Date; priceMinor: number }[] = [];
  for (const rt of roomTypes) {
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + d));
      rows.push({
        tenantId: session.tenantId,
        propertyId: property.id,
        ratePlanId: plan.id,
        roomTypeId: rt.id,
        date,
        priceMinor,
      });
    }
  }
  await prisma.ratePrice.createMany({ data: rows, skipDuplicates: true });

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

  revalidatePath("/settings");
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

  revalidatePath("/settings");
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
  redirect("/dashboard?welcome=done");
}
