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
import { markBillable, writeWelcomeProperty, writeWelcomeRoomType, writeWelcomePrice } from "@revio/db";
import type { WelcomeWrite } from "@revio/db";
import { fill, translate } from "@revio/ui/i18n";
import { welcomeStrings } from "@revio/ui/welcome-strings";
import { getLocale } from "./locale";
import { welcome as welcomeDict } from "./i18n/welcome";
import { shell as shellDict } from "./i18n/shell";

/** What these actions refuse with, in the reader's language. */
async function say() {
  return translate(welcomeDict, await getLocale()).errors;
}

/** A shared write's refusal, said by its code — the English sentence only when there is none. */
async function refusal(res: WelcomeWrite): Promise<WelcomeResult> {
  const locale = await getLocale();
  const t = translate(welcomeStrings, locale).errors;
  // `price_no_plan` names the screen where a plan is added — in the reader's own navigation words.
  const said = res.code ? fill(t[res.code], { screen: translate(shellDict, locale).nav["/rooms-rates"] }) : "";
  return { error: said || res.error };
}

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
  if (!session) return { error: (await say()).expired };

  const res = await writeWelcomeProperty({ tenantId: session.tenantId, propertyId: session.activePropertyId }, {
    name: str(fd, "name"), address: str(fd, "address"), contactEmail: str(fd, "contactEmail"),
    phone: str(fd, "phone"), timezone: str(fd, "timezone"), baseCurrency: str(fd, "baseCurrency"),
    checkInTime: str(fd, "checkInTime"), checkOutTime: str(fd, "checkOutTime"),
  });
  if (res.error) return refusal(res);
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
  if (!session) return { error: (await say()).expired };
  const property = await getProperty();

  const res = await writeWelcomeRoomType(
    { tenantId: session.tenantId, propertyId: property.id },
    { name: str(fd, "name"), totalRooms: str(fd, "totalRooms"), maxGuests: str(fd, "maxGuests") },
  );
  if (res.error) return refusal(res);
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
  if (!session) return { error: (await say()).expired };
  const property = await getProperty();

  const res = await writeWelcomePrice(
    { tenantId: session.tenantId, propertyId: property.id, timezone: property.timezone },
    { price: str(fd, "price"), rateScreen: "Rooms & Rates" },
  );
  if (res.error) return refusal(res);
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
  if (!session) return { error: (await say()).expired };

  const colour = str(fd, "emailBrandColor").trim();
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) {
    return { error: (await say()).colour };
  }

  const logo = str(fd, "emailLogoUrl").trim();
  if (logo && !/^https:\/\//.test(logo)) {
    // http:// logos are blocked by mail clients and browsers alike; failing here is kinder than a
    // broken image on every confirmation a guest receives.
    return { error: (await say()).logo };
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
  if (!session) return { error: (await say()).expired };

  const primary = str(fd, "reservationEmailPrimary").trim();
  const secondary = str(fd, "reservationEmailSecondary").trim();
  if (!primary) return { error: (await say()).deliveryMissing };
  if (!primary.includes("@")) return { error: (await say()).deliveryBad };
  if (secondary && !secondary.includes("@")) return { error: (await say()).secondBad };

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

  revalidatePath("/settings", "layout");
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
