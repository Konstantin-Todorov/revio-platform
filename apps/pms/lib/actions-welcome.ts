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
import { markBillable, writeWelcomeProperty, writeWelcomeRoomType, writeWelcomeTaxes } from "@revio/db";
import { flashError } from "@revio/ui/flash";

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
  const { session, property } = await activeProperty();

  const res = await writeWelcomeProperty({ tenantId: session.tenantId, propertyId: property.id }, {
    name: str(fd, "name"), address: str(fd, "address"), contactEmail: str(fd, "contactEmail"),
    phone: str(fd, "phone"), timezone: str(fd, "timezone"), baseCurrency: str(fd, "baseCurrency"),
    checkInTime: str(fd, "checkInTime"), checkOutTime: str(fd, "checkOutTime"),
  });
  if (res.error) return res;
  return advance("property");
}

/** Step 2 — room types, when nothing else on the platform has created them yet. */
export async function addWelcomeRoomType(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  if (!(await requireManager())) return NOT_A_MANAGER;
  const { session, property } = await activeProperty();

  // Shared with RevioLink and RevioCRS — and so, since 2026-09-23, linked to every rate plan like
  // theirs. This copy used not to be, which left a PMS-first hotel with rooms no plan could sell.
  const res = await writeWelcomeRoomType(
    { tenantId: session.tenantId, propertyId: property.id },
    { name: str(fd, "name"), totalRooms: str(fd, "totalRooms"), maxGuests: str(fd, "maxGuests") },
  );
  if (res.error) return res;
  revalidatePath("/welcome/rooms");
  return {};
}

export async function removeWelcomeRoomType(fd: FormData): Promise<void> {
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
  const { property } = await activeProperty();
  const rt = await prisma.roomType.findUnique({ where: { id: str(fd, "id") } });
  if (!rt || rt.propertyId !== property.id) return;
  await prisma.roomType.delete({ where: { id: rt.id } });
  revalidatePath("/welcome/rooms");
}

export async function finishWelcomeRooms(): Promise<void> {
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
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
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
  const { property } = await activeProperty();
  const unit = await prisma.unit.findUnique({ where: { id: str(fd, "id") } });
  if (!unit || unit.propertyId !== property.id) return;
  await prisma.unit.delete({ where: { id: unit.id } });
  revalidatePath("/welcome/units");
}

export async function finishWelcomeUnits(): Promise<void> {
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
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

  const res = await writeWelcomeTaxes({ tenantId: session.tenantId, propertyId: property.id }, {
    vatStandardPct: str(fd, "vatStandardPct"), vatReducedPct: str(fd, "vatReducedPct"), cityTax: str(fd, "cityTax"),
    invoiceIssuerName: str(fd, "invoiceIssuerName"), invoiceVatId: str(fd, "invoiceVatId"), invoiceAddress: str(fd, "invoiceAddress"),
  });
  if (res.error) return res;
  revalidatePath("/configuration");
  return advance("taxes");
}

/** Leave a step for later. It stays on the dashboard checklist, which is the point of allowing it. */
export async function skipWelcomeStep(fd: FormData): Promise<void> {
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
  await advance(str(fd, "from"));
}

/** The last screen. Records that first-run is over so the flow never reappears. */
export async function finishWelcome(): Promise<void> {
  if (!(await requireManager())) return flashError("You don’t have permission to do that. Setting the property up is a manager’s job.");
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
