import { forSystem } from "./rls.js";
import { issueToken } from "./auth-tokens.js";
import { signupSlug, TRIAL_DAYS, validateSignup, type ProductKey } from "@revio/core";

/**
 * A hotel signing itself up, with nobody at Revio involved.
 *
 * ## The shape, and why it is this shape
 *
 * A tenant is created **immediately but inert**: `status = "pending_signup"`, every entitlement
 * off, no trial running. Nothing about it works until somebody opens the emailed link and chooses a
 * password — and because every app already refuses a session whose `tenant.status !== "active"`,
 * that inertness is enforced by code that was written long before this feature and cannot be
 * forgotten here. It fails closed for free.
 *
 * The email round-trip **is** the verification. There is no separate "verify your address" step and
 * no pending-signup table holding an unverified password, because the invitation flow already does
 * exactly this and `completePasswordSet` is the single path in the codebase that ever writes a
 * password hash — validation, breach check and all. A parallel path here would be a second way to
 * set a password, which is precisely the thing that flow exists to prevent.
 *
 * ## ⚠️ It must never say whether an address is already registered
 *
 * "That email is already in use" turns this form into a directory of which hoteliers are Revio
 * customers, to anyone who can type. The booking engine already refused this exact shape (K6, guest
 * recognition). So a duplicate produces the SAME answer as a success — go and check your email —
 * and the person who really owns that address gets a mail telling them somebody tried, with a link
 * to sign in or reset. Nothing is created, nothing is leaked, and the real owner is told.
 */

/**
 * ⚠️ No URLs in here. `packages/db` reads no environment and knows no origins — the caller composes
 * the link from the token, the same rule that keeps `packages/core` free of deployment config. The
 * two outcomes below are deliberately indistinguishable to the person filling in the form.
 */
export type SignupOutcome =
  | { ok: true; kind: "created"; token: string; ownerName: string; hotelName: string; email: string; intent: ProductKey }
  | { ok: true; kind: "already-registered"; email: string }
  | { ok: false; message: string };

/** Platform-wide signups allowed per hour. See the note in `createPublicSignup`. */
export const SIGNUPS_PER_HOUR = 12;

export async function createPublicSignup(args: {
  hotelName: string;
  ownerName: string;
  email: string;
  /** What they said they needed. Decides where they land — never what they get. */
  intent: ProductKey;
}): Promise<SignupOutcome> {
  const prisma = forSystem();

  // ⚠️ ONE validator, in `@revio/core`, shared with the form's own action. Two copies of "is this a
  // real address" is how a form accepts something the writer then refuses, or the reverse.
  const valid = validateSignup(args);
  if (!valid.ok) return { ok: false, message: valid.message };
  const { hotelName, ownerName, email, intent } = valid.fields;

  /*
   * A ceiling on how fast the platform can acquire hotels.
   *
   * This endpoint creates a TENANT from the open internet, which is the most expensive row we have.
   * A script could otherwise sit on it all night and fill the operator console with fiction.
   *
   * Counted from the data rather than held in memory on purpose: an in-memory bucket resets on every
   * deploy and is per-instance, so it protects least at exactly the moment traffic is unusual. A
   * count of recent tenants is durable, needs no new table, and — deliberately — stores no IP
   * address, so this guard creates no personal data to protect.
   *
   * It is a ceiling, not a per-person limit: it cannot tell one abuser from twenty real hotels, and
   * a genuine rush hitting it is a good problem that shows up in the operator console rather than a
   * silent loss. Twelve an hour is far above any real signup rate we will see this year and far
   * below what a script would want.
   */
  const recent = await prisma.tenant.count({
    where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= SIGNUPS_PER_HOUR) {
    return {
      ok: false,
      message: "We're seeing an unusual number of signups right now. Try again in a few minutes, or email us and we'll set you up by hand.",
    };
  }

  // See the note above: the SAME answer as a success, and a real mail to the real owner.
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: true, kind: "already-registered", email };
  }

  let slug = signupSlug(hotelName);
  if (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: hotelName,
      slug,
      plan: "starter",
      // ⚠️ Inert until verified. Entitlements stay OFF and no ProductTrial exists, so the 30-day
      // clock does not start for somebody who mistyped their address and never arrives.
      status: "pending_signup",
      signupIntent: intent,
      hasChannelManager: false,
      hasReservation: false,
      hasPms: false,
      users: { create: [{ name: ownerName, email, role: "owner" }] },
      properties: { create: [{ name: hotelName, baseCurrency: "EUR", timezone: "Europe/Sofia" }] },
    },
    include: { properties: true, users: true },
  });

  // The same starting rate plan an operator-created client gets, for the same reason: the calendar,
  // the bulk editor and every derived plan need a manual parent to exist before they mean anything.
  const property = tenant.properties[0]!;
  await prisma.ratePlan.create({
    data: {
      tenantId: tenant.id, propertyId: property.id, name: "Standard Rate", code: "BAR",
      tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0,
    },
  });

  const owner = tenant.users[0]!;
  const token = await issueToken({ purpose: "invite", email, userId: owner.id });

  return { ok: true, kind: "created", token, ownerName, hotelName, email, intent };
}

/**
 * The moment a signup becomes a customer: they proved the mailbox.
 *
 * Called from `completePasswordSet`, so it runs on the ONE path that ever sets a password and
 * cannot be skipped by arriving through a different route. Everything happens in one transaction —
 * an account that is active with no trial is free forever, and a trial with no entitlement is a
 * clock running on a product nobody can open. Neither half is allowed to exist alone.
 *
 * Idempotent and narrow: it does nothing at all unless the tenant is still `pending_signup`, so a
 * staff invitation, a password reset, and a replayed request all fall straight through.
 */
export async function activatePendingSignup(tenantId: string): Promise<boolean> {
  const prisma = forSystem();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true, productTrials: { select: { product: true } } },
  });
  if (!tenant || tenant.status !== "pending_signup") return false;

  const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const already = new Set(tenant.productTrials.map((t) => t.product));

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId, status: "pending_signup" },
      data: {
        status: "active",
        /*
         * ⚠️ ALL THREE, one trial — the founder's decision, and the architecture's own argument.
         *
         * The second and third product cost us almost nothing to deliver: same database, same
         * onboarding, no migration, which is exactly why the price list discounts them. And a hotel
         * does not know our product names, so making them choose one at signup asks them to
         * self-diagnose before they have seen anything — and `canSelfStartTrial` allows one trial
         * per product EVER, so a wrong guess would burn the only trial of the product they needed.
         */
        hasChannelManager: true,
        hasReservation: true,
        hasPms: true,
      },
    });

    for (const product of ["cm", "crs", "pms"] as ProductKey[]) {
      if (already.has(product)) continue;
      await tx.productTrial.create({
        data: {
          tenantId,
          product,
          endsAt,
          // No `grantedById`: nobody at Revio granted this one. The model's comment still says
          // "nobody self-serves a trial", which stopped being true when self-serve trials shipped.
        },
      });
    }
  });

  return true;
}
