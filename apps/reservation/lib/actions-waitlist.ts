"use server";

import { revalidatePath } from "next/cache";
import { flashError, setFlash } from "@revio/ui/flash";
import { JOB, forTenant, withJobLease } from "@revio/db";
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
  // Its own gate, stated here rather than inherited from the call below. It is a POST endpoint in
  // its own right, and `runWaitlistSweep` gating itself is not something a reader of THIS function
  // can see — which is also why authz-lint stopped recognising it the moment the call became an
  // assignment. The second session read costs nothing and the gate is now obvious.
  await requireCapability("manageReservations");

  // A `<form action>` must resolve to void. The counts still matter to other callers, so the
  // real function keeps returning them rather than being flattened to suit one call site.
  const r = await runWaitlistSweep();

  /*
   * Say what happened.
   *
   * The button previously ran the sweep and returned nothing at all. Most sweeps legitimately do
   * nothing — that is the healthy case — so the screen came back identical and the agent could not
   * tell "checked, nothing free" from "the button is broken". They press it again, which is the
   * exact shape `silent-lint` exists to catch, arriving here through a successful path rather than
   * an early return.
   */
  if (r.skipped) {
    return setFlash("info", "A check is already running. This list will update in a moment.");
  }
  const parts: string[] = [];
  if (r.offered > 0) parts.push(`${r.offered} offer${r.offered === 1 ? "" : "s"} sent`);
  if (r.lapsed > 0) parts.push(`${r.lapsed} expired offer${r.lapsed === 1 ? "" : "s"} back on the list`);
  if (r.staled > 0) parts.push(`${r.staled} past their arrival date, closed`);
  if (parts.length === 0) {
    return setFlash("info", "Checked — nothing has opened up for anyone waiting.");
  }
  return setFlash("success", parts.join(" · "));
}

export async function runWaitlistSweep(): Promise<{
  offered: number; lapsed: number; staled: number; skipped?: boolean;
}> {
  const session = await requireCapability("manageReservations");
  const property = await getProperty();

  /*
   * The SAME lease the cron takes, and for the same reason.
   *
   * The scheduled route leases this job because a sweep sends email and places holds, so two runners
   * could act on one freed room. This button ran the identical code with no lease at all, so a click
   * landing while the cron was mid-run — or two clicks in quick succession — was precisely the race
   * the lease was added to prevent.
   *
   * `publicCreateHold` is atomic, so the same ROOM could never be given away twice. The damage was
   * one level up: two concurrent sweeps can each pick the same waiting entry for a *different* room,
   * hold both, and email the guest twice — and only the second `claimToken` survives, so one of
   * those two emails links to nothing while its room sits off sale for the whole offer window.
   *
   * The lease is released the moment the run finishes, so the TTL is only a crash ceiling. It is
   * global rather than per-property because the cron sweeps every property under one lease, and a
   * per-property lease here would not serialise against it.
   */
  const run = await withJobLease(JOB.waitlistSweep, 5 * 60_000, async () => {
    const db = forTenant(session.tenantId);
    const result = await waitlistSweep(db, {
      id: property.id,
      tenantId: session.tenantId,
      name: property.name,
      baseCurrency: property.baseCurrency,
      timezone: property.timezone,
    });

    await sendSweepEmails(db, property.id, property.publicSlug, result);
    return result;
  });

  revalidatePath("/waitlist");

  // Losing the lease is a normal outcome, not an error: the cron is doing this work right now.
  if (!run.ran) return { offered: 0, lapsed: 0, staled: 0, skipped: true };
  return { offered: run.result.offered, lapsed: run.result.lapsed, staled: run.result.staled };
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
