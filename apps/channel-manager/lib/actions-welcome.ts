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
 * The first-run flow's writes.
 *
 * Deliberately thin: each screen collects the least it can and hands off. The heavy operations —
 * bulk pricing, channel connection, mapping — already exist and are reached from the normal screens
 * once setup ends. Reimplementing them here would create a second way to do the same thing, and the
 * second way is always the one that stops being maintained.
 */

export type WelcomeResult = { error?: string };

const PRODUCT = "RevioLink";

/**
 * Where the hotel goes after finishing a screen.
 *
 * The flow is re-derived from the database on every hop rather than held in a session, because the
 * answers change the flow: adding room types decides the property's size, which decides whether the
 * staff screen is asked at all. A remembered step list would be a stale one.
 */
async function advance(from: string): Promise<never> {
  const facts = await getWelcomeFactsForProperty();
  const next = nextStep(welcomeFlow(PRODUCT, facts), from);
  redirect(next ? `/welcome/${next.key}` : "/dashboard");
}

/**
 * Step 1 — who and where they are.
 *
 * Grouped on purpose. The address and contact email are not cosmetic — they print on every
 * confirmation a guest receives — and currency and timezone are the two that quietly ruin things
 * later: a hotel priced in the wrong currency discovers it on an OTA, and a wrong timezone moves
 * every arrival date by a day. Prefilled because we can usually guess, confirmed because we cannot
 * always.
 */
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

/**
 * Step 2 — the room types, and with them the property's size.
 *
 * `totalRooms` is the number the size branch and the pricing tier both read, so this screen decides
 * how many more screens there are. That is stated on it rather than left to surprise them.
 */
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
  await requireCapability("manageSettings");
  const property = await getProperty();
  const id = str(fd, "id");
  const rt = await prisma.roomType.findUnique({ where: { id } });
  // Scoped check as well as RLS: a stray id from another property must not delete anything.
  if (!rt || rt.propertyId !== property.id) return;
  await prisma.roomType.delete({ where: { id } });
  revalidatePath("/welcome/rooms");
}

export async function finishWelcomeRooms(): Promise<void> {
  await requireCapability("manageSettings");
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
  /*
   * ⚠️ Occupancy is required on every RatePrice write since OBP — see the same note in RevioCRS's
   * `actions-welcome.ts`. Written without it, a brand-new hotel finished onboarding and saw "—" on
   * every calendar cell, because `resolveRate` asks for a specific occupancy and a NULL row matches
   * none. Written at the room's ceiling: the per-room one-row shape.
   */
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    select: { id: true, maxGuests: true },
  });
  if (!plan || roomTypes.length === 0) return { error: "Add a room type first." };

  // 180 days is a season, not the full 500-day horizon: enough to be sellable today, small enough
  // that a number typed in thirty seconds is not committed two years out.
  const DAYS = 180;
  const today = new Date();
  const rows: {
    tenantId: string; propertyId: string; ratePlanId: string; roomTypeId: string;
    date: Date; occupancy: number; priceMinor: number;
  }[] = [];
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
  await prisma.ratePrice.createMany({ data: rows, skipDuplicates: true });

  // The plan's own default price, so a date beyond the 180-night window still resolves.
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

  revalidatePath("/calendar");
  return advance("prices");
}

/**
 * The personalisation step — one answer, two guest-facing surfaces.
 *
 * `emailBrandColor` is the root of the branding chain: `bookingBrandColor` is nullable and NULL means
 * "inherit the email colour". So a hotel that sets a colour here has also branded its own booking
 * page without being asked twice, and a hotel that later wants the page to differ can override just
 * that one field. Writing both columns here would break that inheritance permanently.
 */
export async function saveWelcomeBrand(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };

  const colour = str(fd, "emailBrandColor").trim();
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) {
    return { error: "Use a colour like #0E7C86." };
  }

  const logo = str(fd, "emailLogoUrl").trim();
  if (logo && !/^https:\/\//.test(logo)) {
    // http:// logos are blocked by mail clients and browsers alike; failing here is kinder than a
    // broken image on every confirmation a guest receives.
    return { error: "The logo link needs to start with https://" };
  }

  await prisma.property.update({
    where: { id: session.activePropertyId },
    data: {
      emailSenderName: str(fd, "emailSenderName").trim() || null,
      emailBrandColor: colour || null,
      emailLogoUrl: logo || null,
      // bookingBrandColor / bookingLogoUrl are left NULL on purpose — that is what makes the booking
      // page follow this colour instead of freezing a copy of it.
    },
  });

  revalidatePath("/settings/emails");
  return advance("brand");
}

/**
 * Where a channel booking goes when nothing else catches it.
 *
 * Only asked of a hotel running RevioLink alone. Without an address the reservation exists in
 * RevioLink and nowhere a human will look — the difference between a missing setting and a missed
 * guest. Two addresses because reception and the owner are rarely the same inbox.
 */
export async function saveWelcomeDelivery(_prev: WelcomeResult | null, fd: FormData): Promise<WelcomeResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { error: _g.error };
  const session = await getSession();
  if (!session) return { error: "Your session expired — sign in again." };

  const primary = str(fd, "reservationEmailPrimary").trim();
  const secondary = str(fd, "reservationEmailSecondary").trim();
  if (!primary) return { error: "Enter the address your bookings should go to." };
  if (!primary.includes("@")) return { error: "That email doesn't look right." };
  if (secondary && !secondary.includes("@")) return { error: "The second email doesn't look right." };

  await prisma.property.update({
    where: { id: session.activePropertyId },
    data: {
      reservationEmailPrimary: primary,
      reservationEmailSecondary: secondary || null,
      // Tomorrow's arrivals, not today's: a list that arrives the evening before is something
      // reception can act on. One that arrives at 07:00 on the day is a list of surprises.
      notifyTomorrowArrivals: fd.get("notifyTomorrowArrivals") != null,
    },
  });

  revalidatePath("/settings");
  return advance("delivery");
}

/** Leave a step for later. It stays on the dashboard checklist, which is the point of allowing it. */
export async function skipWelcomeStep(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  await advance(str(fd, "from"));
}

/**
 * The last screen. Records that first-run is over so the flow never reappears.
 *
 * `setupCompleted` is a list rather than a boolean because a hotel runs up to three products and
 * finishes their setups at different times. The value comes from `SETUP_KEY` rather than being
 * written here as a literal: this action once wrote "RevioLink" while every checklist read "cm",
 * which meant finishing the guided flow did not stop the checklist asking again.
 */
export async function finishWelcome(): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  if (!hasFinishedSetup(property.setupCompleted, PRODUCT)) {
    // Guarded in the WHERE clause, not in JS: two submissions racing would otherwise both push.
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
