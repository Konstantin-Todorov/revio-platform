"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { welcomeFlow, totalRooms as sumRooms } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getProperty } from "./data";
import { str } from "./mutation-helpers";

/**
 * The first-run flow's writes.
 *
 * Deliberately thin: each screen collects the least it can and hands off. The heavy operations —
 * bulk pricing, channel connection, mapping — already exist and are reached from the normal screens
 * once setup ends. Reimplementing them here would create a second way to do the same thing, and the
 * second way is always the one that stops being maintained.
 */

export type WelcomeResult = { error?: string };

/** Where the hotel goes after finishing a screen — the next step, or the dashboard when done. */
async function advance(from: string): Promise<never> {
  const property = await getProperty();
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    select: { totalRooms: true },
  });
  const steps = welcomeFlow("RevioLink", sumRooms(roomTypes));
  const i = steps.findIndex((s) => s.key === from);
  const next = i >= 0 ? steps[i + 1] : undefined;
  redirect(next ? `/welcome/${next.key}` : "/dashboard");
}

/**
 * Step 1 — confirm what we filled in for them.
 *
 * Currency and timezone are the two that quietly ruin things later: a hotel priced in the wrong
 * currency discovers it on an OTA, and a wrong timezone moves every arrival date by a day. They are
 * prefilled because we can usually guess, and confirmed because we cannot always.
 */
export async function saveWelcomeProperty(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };

  const name = str(fd, "name").trim();
  if (!name) return { error: "Your property needs a name." };

  await prisma.property.update({
    where: { id: session.activePropertyId },
    data: {
      name,
      timezone: str(fd, "timezone") || "Europe/Sofia",
      baseCurrency: str(fd, "baseCurrency") || "EUR",
      checkOutTime: str(fd, "checkOutTime") || "12:00",
    },
  });

  revalidatePath("/", "layout");
  return advance("property");
}

/**
 * Step 2 — the room types, and with them the property's size.
 *
 * `totalRooms` is the number the size branch and the pricing tier both read, so this screen decides
 * how many more screens there are. That is stated on it rather than left to surprise them.
 */
export async function addWelcomeRoomType(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };
  const property = await getProperty();

  const name = str(fd, "name").trim();
  const rooms = Number.parseInt(str(fd, "totalRooms"), 10);
  const guests = Number.parseInt(str(fd, "maxGuests"), 10);

  if (!name) return { error: "Give the room type a name — “Double Room” is fine." };
  if (!Number.isFinite(rooms) || rooms < 1) return { error: "How many of these rooms do you have?" };
  if (!Number.isFinite(guests) || guests < 1) return { error: "How many guests fit in one?" };

  // A code is what OTAs key on. Derived rather than asked: nobody buying a channel manager wants to
  // invent one, and it is editable later in Rooms & Rates.
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

  // Same rule as the Rooms & Rates screen: a new room type becomes sellable under every rate plan.
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
  const property = await getProperty();
  const id = str(fd, "id");
  const rt = await prisma.roomType.findUnique({ where: { id } });
  // Scoped check as well as RLS: a stray id from another property must not delete anything.
  if (!rt || rt.propertyId !== property.id) return;
  await prisma.roomType.delete({ where: { id } });
  revalidatePath("/welcome/rooms");
}

export async function finishWelcomeRooms(): Promise<void> {
  const property = await getProperty();
  const count = await prisma.roomType.count({ where: { propertyId: property.id } });
  if (count === 0) return; // the screen already blocks this; belt and braces
  await advance("rooms");
}

/**
 * Step 3 — one price, applied across the whole priced horizon.
 *
 * A single number rather than a calendar, because a hotel with no prices at all cannot sell anything,
 * and "price every date" is not a first-day task. They vary it afterwards on the calendar or in bulk.
 *
 * This is the one money field in the flow, and it is **empty by default** — never prefilled. A
 * suggested rate that 70–90% of people never change is revenue quietly decided by us.
 */
export async function setWelcomePrice(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
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

  // 180 days is a season, not the full 500-day horizon: enough to be sellable today, small enough
  // that a number typed in thirty seconds is not committed two years out.
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

/** Leave a step for later. It stays on the dashboard checklist, which is the point of allowing it. */
export async function skipWelcomeStep(fd: FormData): Promise<void> {
  await advance(str(fd, "from"));
}

/**
 * The last screen. Records that first-run is over so the flow never reappears.
 *
 * `setupCompleted` is a list rather than a boolean because a hotel runs up to three products and
 * finishes their setups at different times.
 */
export async function finishWelcome(): Promise<void> {
  const property = await getProperty();
  if (!property.setupCompleted.includes("RevioLink")) {
    await prisma.property.update({
      where: { id: property.id },
      data: { setupCompleted: { push: "RevioLink" } },
    });
  }
  revalidatePath("/", "layout");
  redirect("/dashboard?welcome=done");
}
