"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SETUP_KEY, hasFinishedSetup, nextStep, welcomeFlow } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { MANAGER_ROLES } from "./roles";
import { activeProperty } from "./data";
import { getWelcomeFactsForProperty } from "./welcome";
import { str } from "./mutation-helpers";
import { markBillable } from "@revio/db";

/**
 * RevioPMS's first-run writes.
 *
 * The PMS asks the fewest questions of the three and the most specific one: the physical rooms.
 * A room type is a thing you sell; a unit is a door. Reception cannot check anybody in until the
 * doors exist, which is why that step is the only one here that no other product can supply.
 */

export type WelcomeResult = { error?: string };

const PRODUCT = "RevioPMS";

/**
 * First-run writes are manager-only.
 *
 * These actions were reachable by anyone with a session. The setup screens live outside
 * `(protected)` and are only ever *shown* to an owner, but a server action is a POST endpoint and
 * Next runs it before it re-renders anything — so showing the screen to nobody else protected
 * nothing. A housekeeper could rename the property, change the VAT rate that prints on every
 * invoice, or generate rooms, with one crafted request. That is the same hole as the folio one
 * found earlier, in the one flow where the property's identity and tax settings are decided.
 */
const NOT_A_MANAGER: WelcomeResult = { error: "Only an Owner, Admin or Manager can complete setup." };

async function requireManager() {
  const s = await getSession();
  if (!s || !MANAGER_ROLES.has(s.role)) return null;
  return s;
}

async function advance(from: string): Promise<never> {
  const facts = await getWelcomeFactsForProperty();
  const next = nextStep(welcomeFlow(PRODUCT, facts), from);
  redirect(next ? `/welcome/${next.key}` : "/dashboard");
}

/** Step 1 — who and where they are. Address and contact details print on every document. */
export async function saveWelcomeProperty(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  if (!(await requireManager())) return NOT_A_MANAGER;
  const { property } = await activeProperty();

  const name = str(fd, "name").trim();
  if (!name) return { error: "Your property needs a name." };

  const contactEmail = str(fd, "contactEmail").trim();
  if (contactEmail && !contactEmail.includes("@")) return { error: "That contact email doesn't look right." };

  await prisma.property.update({
    where: { id: property.id },
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

/** Step 2 — room types, when nothing else on the platform has created them yet. */
export async function addWelcomeRoomType(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  if (!(await requireManager())) return NOT_A_MANAGER;
  const { session, property } = await activeProperty();

  const name = str(fd, "name").trim();
  const rooms = Number.parseInt(str(fd, "totalRooms"), 10);
  const guests = Number.parseInt(str(fd, "maxGuests"), 10);

  if (!name) return { error: "Give the room type a name — “Double Room” is fine." };
  if (!Number.isFinite(rooms) || rooms < 1) return { error: "How many of these rooms do you have?" };
  if (!Number.isFinite(guests) || guests < 1) return { error: "How many guests fit in one?" };

  const base = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "RM";
  const taken = await prisma.roomType.findMany({ where: { propertyId: property.id }, select: { code: true } });
  const codes = new Set(taken.map((t) => t.code));
  let code = base;
  for (let n = 2; codes.has(code); n++) code = `${base}${n}`;

  const count = await prisma.roomType.count({ where: { propertyId: property.id } });
  await prisma.roomType.create({
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

  revalidatePath("/welcome/rooms");
  return {};
}

export async function removeWelcomeRoomType(fd: FormData): Promise<void> {
  if (!(await requireManager())) return;
  const { property } = await activeProperty();
  const rt = await prisma.roomType.findUnique({ where: { id: str(fd, "id") } });
  if (!rt || rt.propertyId !== property.id) return;
  await prisma.roomType.delete({ where: { id: rt.id } });
  revalidatePath("/welcome/rooms");
}

export async function finishWelcomeRooms(): Promise<void> {
  if (!(await requireManager())) return;
  const { property } = await activeProperty();
  const count = await prisma.roomType.count({ where: { propertyId: property.id } });
  if (count === 0) return;
  await advance("rooms");
}

/**
 * The doors — added a floor at a time rather than one at a time.
 *
 * A 40-room hotel typing forty labels by hand is the point at which somebody abandons setup, so this
 * takes a room type, a starting number and a count and generates the run. Labels that already exist
 * are skipped rather than duplicated, which makes running it twice safe.
 */
export async function addWelcomeUnits(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  if (!(await requireManager())) return NOT_A_MANAGER;
  const { session, property } = await activeProperty();

  const roomTypeId = str(fd, "roomTypeId");
  const from = Number.parseInt(str(fd, "from"), 10);
  const count = Number.parseInt(str(fd, "count"), 10);
  const floor = str(fd, "floor").trim();

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.propertyId !== property.id) return { error: "Choose a room type." };
  if (!Number.isFinite(from) || from < 0) return { error: "Where do the numbers start? For example 101." };
  if (!Number.isFinite(count) || count < 1 || count > 200) {
    return { error: "How many rooms? Up to 200 at a time." };
  }

  const existing = await prisma.unit.findMany({ where: { propertyId: property.id }, select: { label: true } });
  const taken = new Set(existing.map((u) => u.label));
  const sortStart = existing.length;

  const rows = [];
  for (let i = 0; i < count; i++) {
    const label = String(from + i);
    if (taken.has(label)) continue; // running it twice must not create "101" twice
    rows.push({
      tenantId: session.tenantId,
      propertyId: property.id,
      roomTypeId,
      label,
      ...(floor ? { floor } : {}),
      sortOrder: sortStart + i,
    });
  }
  if (rows.length === 0) return { error: "Those room numbers already exist." };
  await prisma.unit.createMany({ data: rows });

  revalidatePath("/welcome/units");
  return {};
}

export async function removeWelcomeUnit(fd: FormData): Promise<void> {
  if (!(await requireManager())) return;
  const { property } = await activeProperty();
  const unit = await prisma.unit.findUnique({ where: { id: str(fd, "id") } });
  if (!unit || unit.propertyId !== property.id) return;
  await prisma.unit.delete({ where: { id: unit.id } });
  revalidatePath("/welcome/units");
}

export async function finishWelcomeUnits(): Promise<void> {
  if (!(await requireManager())) return;
  const { property } = await activeProperty();
  const count = await prisma.unit.count({ where: { propertyId: property.id } });
  if (count === 0) return;
  await advance("units");
}

/**
 * Tax and invoicing — shared with RevioCRS, and asked by whichever product gets there first.
 *
 * A hotel could previously finish setup and issue a tax document carrying no VAT number, because
 * `invoiceIssuerName` / `invoiceVatId` / `invoiceAddress` were asked on no screen in any product.
 */
export async function saveWelcomeTaxes(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  if (!(await requireManager())) return NOT_A_MANAGER;
  const { session, property } = await activeProperty();

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

  const invoiceFields = {
    invoiceIssuerName: str(fd, "invoiceIssuerName").trim() || null,
    invoiceVatId: str(fd, "invoiceVatId").trim() || null,
    invoiceAddress: str(fd, "invoiceAddress").trim() || null,
  };

  await prisma.propertyDefaults.upsert({
    where: { propertyId: property.id },
    create: {
      tenantId: session.tenantId,
      propertyId: property.id,
      vatStandardPct: standard,
      vatReducedPct: reduced,
      ...invoiceFields,
    },
    update: { vatStandardPct: standard, vatReducedPct: reduced, ...invoiceFields },
  });

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
    // Deactivate rather than delete: a fee already charged on a folio must survive so that folio can
    // still explain itself.
    await prisma.taxFee.update({ where: { id: existing.id }, data: { active: false } });
  }

  revalidatePath("/configuration");
  return advance("taxes");
}

/** Leave a step for later. It stays on the dashboard checklist, which is the point of allowing it. */
export async function skipWelcomeStep(fd: FormData): Promise<void> {
  if (!(await requireManager())) return;
  await advance(str(fd, "from"));
}

/** The last screen. Records that first-run is over so the flow never reappears. */
export async function finishWelcome(): Promise<void> {
  if (!(await requireManager())) return;
  const { property } = await activeProperty();
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
