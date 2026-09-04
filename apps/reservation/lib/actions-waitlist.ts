"use server";

import { revalidatePath } from "next/cache";
import { flashError } from "@revio/ui/flash";
import { forTenant } from "@revio/db";
import { waitlistSweep } from "@revio/booking";
import { sendSweepEmails } from "./waitlist-emails";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { prisma } from "./db";

/**
 * Staff writes on the waitlist.
 *
 * Every one calls `requireCapability` as its **first statement**, before reading FormData and before
 * touching the database. A server action is a POST endpoint and Next runs it *before* re-rendering,
 * so a layout redirect fires after the write has committed — hiding a button protects nobody.
 *
 * `manageReservations` rather than a new capability: a waitlist entry becomes a reservation, and
 * whoever may take a booking may take one from the list. Inventing a capability here would leave
 * every existing role unable to use the feature on the day it shipped.
 */

/**
 * Run the sweep now.
 *
 * Normally this happens lazily on page load, like hold expiry. This is the button for a front-desk
 * agent who has just cancelled a booking and wants the queue to notice before the guest is off the
 * phone — the alternative is telling them to wait for a job they cannot see.
 */
export async function sweepWaitlistForm(): Promise<void> {
  // A `<form action>` must resolve to void. The counts still matter to other callers, so the
  // real function keeps returning them rather than being flattened to suit one call site.
  await runWaitlistSweep();
}

export async function runWaitlistSweep(): Promise<{ offered: number; lapsed: number; staled: number }> {
  const session = await requireCapability("manageReservations");
  const property = await getProperty();

  const db = forTenant(session.tenantId);
  const result = await waitlistSweep(db, {
    id: property.id,
    tenantId: session.tenantId,
    name: property.name,
    baseCurrency: property.baseCurrency,
    timezone: property.timezone,
  });

  await sendSweepEmails(db, property.id, property.publicSlug, result);

  revalidatePath("/waitlist");
  return { offered: result.offered, lapsed: result.lapsed, staled: result.staled };
}

/**
 * Take someone off the list.
 *
 * `cancelled`, never a delete. The row is how "recovered revenue" and conversion rate are counted,
 * and deleting it would quietly improve our own numbers by removing the failures from the
 * denominator.
 */
export async function removeWaitlistEntry(fd: FormData): Promise<void> {
  await requireCapability("manageReservations");
  const id = typeof fd.get("id") === "string" ? (fd.get("id") as string) : "";
  // Not a silent bail-out. This can only happen to a POST that did not come from our own form, but
  // a void action that returns nothing leaves the page looking untouched — so whoever is looking at
  // it presses the button again, and the second press is as silent as the first.
  if (!id) return flashError("Nothing was selected to remove. Reload the page and try again.");

  const property = await getProperty();
  // Scoped by property as well as by RLS: the tenant may run several hotels, and an id from another
  // one must not be actionable from this screen.
  await prisma.waitlistEntry.updateMany({
    where: { id, propertyId: property.id },
    data: { status: "cancelled", offerHoldId: null, offerExpiresAt: null, claimToken: null },
  });

  revalidatePath("/waitlist");
}
