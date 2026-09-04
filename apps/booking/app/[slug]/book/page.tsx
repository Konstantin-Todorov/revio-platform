import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BedDouble, Users } from "lucide-react";
import { checkHold, clientIp, publicCreateHold, publicGetHold, publicSellableExtras } from "@revio/booking";
import { forTenant } from "@revio/db";
import { getObjectStore } from "@revio/storage";
import { getPublicProperty } from "@/lib/property";
import { searchAvailability } from "@/lib/availability";
import { fmtDay, isValidISO, money, nightsBetween } from "@/lib/dates";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { StepBar } from "@/components/StepBar";
import { BookingForm } from "@/components/BookingForm";
import { LiveTotal } from "@/components/LiveTotal";

export const dynamic = "force-dynamic";

/**
 * Step 3 — the room is held, the guest fills in who they are.
 *
 * The stay is RE-QUOTED here rather than carried from the results page. A guest can sit on a tab
 * for an hour, and a price that moved in between must be the new price, not the stale one they were
 * shown. Re-quoting also means the summary on this page and the total the server books cannot
 * disagree, because both come from the same call.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const checkIn = isValidISO(sp.checkIn) ? sp.checkIn : null;
  const checkOut = isValidISO(sp.checkOut) ? sp.checkOut : null;
  const guestsRaw = Number.parseInt(sp.guests ?? "2", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw >= 1 && guestsRaw <= 10 ? guestsRaw : 2;
  const roomTypeId = sp.roomTypeId ?? "";
  const ratePlanId = sp.ratePlanId ?? "";

  // A half-formed URL goes back to the search rather than to an error — this link gets shared,
  // bookmarked and truncated by messaging apps.
  if (!checkIn || !checkOut || !roomTypeId || !ratePlanId || nightsBetween(checkIn, checkOut) < 1) {
    redirect(`/${slug}/search`);
  }

  const ip = clientIp(await headers());
  const nights = nightsBetween(checkIn, checkOut);

  const [outcome, store] = await Promise.all([
    searchAvailability(property, ip, { checkIn, checkOut, guests }),
    getObjectStore(),
  ]);

  const option = (outcome.options ?? []).find((o) => o.roomTypeId === roomTypeId);
  const plan = option?.plans.find((p) => p.ratePlanId === ratePlanId);
  // Gone while they were deciding. Back to the results, where the alternatives already live.
  if (!option || !plan) {
    redirect(`/${slug}/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
  }

  /**
   * Hold-on-open. Reusing an existing hold from the URL matters as much as creating one: a guest who
   * refreshes, or comes back via the browser's back button, must not accumulate holds — that would
   * let one indecisive person quietly take a small hotel's whole inventory off sale.
   */
  const db = forTenant(property.tenantId);

  // What this hotel sells alongside the room. Empty is the normal case and renders nothing.
  const extras = await publicSellableExtras(db, property.id);
  const existing = sp.hold ? await publicGetHold(db, property.id, sp.hold) : null;
  let hold = existing;

  if (!hold) {
    // Same limiter as the public API: holds are the one anonymous action with real inventory cost.
    if (!checkHold(ip, property.id).ok) {
      redirect(`/${slug}/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
    }
    const created = await publicCreateHold(db, { ...property, id: property.id }, {
      checkIn, checkOut, guests, roomTypeId,
    });
    if (created.error || !created.hold) {
      redirect(`/${slug}/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
    }
    hold = created.hold;
    // Put the hold in the URL so a refresh finds it instead of taking a second room.
    redirect(
      `/${slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}` +
        `&roomTypeId=${roomTypeId}&ratePlanId=${ratePlanId}&hold=${hold.id}`,
    );
  }

  const cover = option.photos[0];

  return (
    <>
      <PropertyHeader property={property} />

      <main className="mx-auto w-full max-w-[62rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar
          current="Details"
          backHref={`/${slug}/search?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}
        />

        <h1 className="display mt-6 text-[1.85rem] sm:mt-8 sm:text-[2.4rem]">Almost there</h1>
        <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
          {fmtDay(checkIn)} — {fmtDay(checkOut)} · {nights} {nights === 1 ? "night" : "nights"} ·{" "}
          {guests} {guests === 1 ? "guest" : "guests"}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_21rem] lg:items-start">
          <BookingForm
            stay={{ slug, checkIn, checkOut, guests, roomTypeId, ratePlanId, holdId: hold.id }}
            cancellationPolicy={plan.cancellationPolicy}
            expiresAt={hold.expiresAt.toISOString()}
            paymentReady={property.paymentReady}
            extras={extras}
            nights={nights}
            currency={plan.currency}
          />

          {/* The summary follows on desktop so the total is never off-screen while they type. */}
          <aside className="card-raised overflow-hidden lg:sticky lg:top-5">
            {cover ? (
              <img
                src={store.publicUrl(cover.thumbKey)}
                alt={cover.alt || option.name}
                width={cover.width}
                height={cover.height}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div
                className="flex aspect-[4/3] w-full items-center justify-center"
                style={{ background: "linear-gradient(150deg, hsl(var(--brand-wash)), hsl(var(--brand-soft) / 0.65))" }}
                aria-hidden
              >
                <BedDouble size={26} strokeWidth={1.4} style={{ color: "hsl(var(--brand-text) / 0.35)" }} />
              </div>
            )}

            <div className="p-5">
              <h2 className="display text-[1.15rem]">{option.name}</h2>
              <p className="mt-1.5 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
                {plan.name}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                <Users size={13} aria-hidden />
                Sleeps up to {option.maxGuests}
              </p>

              <dl className="mt-4 space-y-1.5 border-t pt-4 text-[13px]" style={{ borderColor: "hsl(var(--line))" }}>
                <Line label={`Rooms · ${nights} ${nights === 1 ? "night" : "nights"}`}
                      value={money(plan.accommodationMinor, plan.currency)} />
                {plan.charges.map((c) => (
                  <Line key={c.name} label={c.name} value={money(c.amountMinor, plan.currency)} />
                ))}
              </dl>

              {/* One total, and it follows the extras — see LiveTotal. */}
              <LiveTotal baseTotalMinor={plan.totalMinor} currency={plan.currency} />
              <p className="mt-1.5 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
                Everything included. Paid at the hotel.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <PropertyFooter property={property} />
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: "hsl(var(--ink-soft))" }}>{label}</dt>
      <dd className="nums font-semibold">{value}</dd>
    </div>
  );
}
