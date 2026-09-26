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
import { markBillable, writeWelcomeProperty, writeWelcomeRoomType, writeWelcomePrice, writeWelcomeTaxes } from "@revio/db";
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
  if (!session) return { error: (await say()).expired };

  const res = await writeWelcomeProperty({ tenantId: session.tenantId, propertyId: session.activePropertyId }, {
    name: str(fd, "name"), address: str(fd, "address"), contactEmail: str(fd, "contactEmail"),
    phone: str(fd, "phone"), timezone: str(fd, "timezone"), baseCurrency: str(fd, "baseCurrency"),
    checkInTime: str(fd, "checkInTime"), checkOutTime: str(fd, "checkOutTime"),
  });
  if (res.error) return refusal(res);
  return advance("property");
}

/** Step 2 — the room types, and with them the property's size. */
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
  if (!session) return { error: (await say()).expired };
  const property = await getProperty();

  const res = await writeWelcomeTaxes({ tenantId: session.tenantId, propertyId: property.id }, {
    vatStandardPct: str(fd, "vatStandardPct"), vatReducedPct: str(fd, "vatReducedPct"), cityTax: str(fd, "cityTax"),
    invoiceIssuerName: str(fd, "invoiceIssuerName"), invoiceVatId: str(fd, "invoiceVatId"), invoiceAddress: str(fd, "invoiceAddress"),
  });
  if (res.error) return refusal(res);
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
  if (!session) return { error: (await say()).expired };

  const colour = str(fd, "emailBrandColor").trim();
  if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) return { error: (await say()).colour };

  const logo = str(fd, "emailLogoUrl").trim();
  if (logo && !/^https:\/\//.test(logo)) return { error: (await say()).logo };

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
