import { notFound, redirect } from "next/navigation";
import { forTenant } from "@revio/db";
import { publicAvailability, publicGetHold } from "@revio/booking";
import Link from "next/link";
import { getPublicProperty } from "@/lib/property";

/**
 * The link in the offer email.
 *
 * A single-use claim token rather than a login: the guest has no account, and asking a stranger to
 * make one in order to accept a room we already reserved for them is how an offer stops converting.
 *
 * ## Every failure is a designed page, not a 404
 *
 * There are four ways to arrive here holding nothing — the token is unknown, the offer already
 * lapsed, the entry was withdrawn, or somebody claimed it first — and only the first is a mistake.
 * The other three are the normal life of a waitlist, and a guest who followed a link we sent them
 * must never be shown an error page for a system working correctly. They are told what happened,
 * plainly, and offered the search.
 *
 * ## The token is not a secret worth guessing
 *
 * It is a v4 UUID, single use, and it only ever hands over a room that is already held for this
 * entry — there is nothing to escalate to. It is cleared when the offer lapses, so a screenshotted
 * link from last week resolves to nothing.
 */
export const dynamic = "force-dynamic";

/**
 * Local rather than shared with the search page's own `Notice`.
 *
 * That one is a private function in a file a parallel change may be editing, and lifting it into a
 * shared component to save eleven lines would be a refactor of someone else's file in the middle of
 * their work. If a third caller appears, extract it then.
 */
function Outcome({
  property,
  title,
  children,
}: {
  property: { name: string; slug: string };
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-[22px] font-bold" style={{ color: "hsl(var(--brand-text))" }}>
        {title}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
        {children}
      </p>
      <Link
        href={`/${property.slug}/search`}
        className="mt-6 inline-flex h-10 items-center rounded-[var(--r-sm)] px-4 text-[14px] font-semibold text-white"
        style={{ backgroundColor: "hsl(var(--brand))" }}
      >
        Search other dates at {property.name}
      </Link>
    </main>
  );
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const db = forTenant(property.tenantId);

  const entry = await db.waitlistEntry.findFirst({
    where: { propertyId: property.id, claimToken: token },
    select: {
      id: true, status: true, checkIn: true, checkOut: true, guests: true,
      offerHoldId: true, offerExpiresAt: true, guestName: true,
    },
  });

  // Unknown token: the one case that is genuinely a mistake, and still not an error page.
  if (!entry) {
    return (
      <Outcome property={property} title="This link has expired">
        We could not find an open offer for this link. If a room opens up again we will email you —
        you are still on the list unless you asked us to take you off it.
      </Outcome>
    );
  }

  if (entry.status !== "offered" || !entry.offerHoldId || !entry.offerExpiresAt) {
    return (
      <Outcome property={property} title="That offer has already been used">
        This room has either been booked or the offer was withdrawn. You are still on the list for
        these dates, and we will email you if something else opens up.
      </Outcome>
    );
  }

  if (entry.offerExpiresAt.getTime() <= Date.now()) {
    return (
      <Outcome property={property} title="That room has gone">
        The offer ran out before this link was opened, so the room went to the next guest waiting.
        You are still on the list — we will email you if another opens up.
      </Outcome>
    );
  }

  // The hold is the thing that makes the offer real. If it is gone the offer is not honourable,
  // whatever the entry says — so trust the hold, not the row that points at it.
  const hold = await publicGetHold(db, property.id, entry.offerHoldId);
  if (!hold) {
    return (
      <Outcome property={property} title="That room has just been taken">
        We are sorry — the room was released before you opened this link. You are still on the list
        and we will email you if another opens up.
      </Outcome>
    );
  }

  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const checkIn = ymd(entry.checkIn);
  const checkOut = ymd(entry.checkOut);

  /*
   * The offer holds a ROOM TYPE, not a rate. Re-quoting here rather than storing a rate plan on the
   * entry is deliberate: an offer may be hours old, and the guest must be charged today's price for
   * the plan they are about to see — the same rule that makes every other quote in this engine
   * re-derived rather than carried.
   */
  const { options } = await publicAvailability(db, property, { checkIn, checkOut, guests: entry.guests });
  const option = options?.find((o) => o.roomTypeId === hold.roomTypeId);
  const ratePlanId = option?.plans?.[0]?.ratePlanId;

  if (!ratePlanId) {
    return (
      <Outcome property={property} title="That room has just been taken">
        We could not price this stay any more, which usually means the room went while this link was
        open. You are still on the list for these dates.
      </Outcome>
    );
  }

  // Straight into the normal checkout, reusing the hold we already placed — the guest never sees a
  // second reservation path, and the room is not taken twice.
  redirect(
    `/${slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${entry.guests}` +
      `&roomTypeId=${hold.roomTypeId}&ratePlanId=${ratePlanId}&hold=${hold.id}`,
  );
}
