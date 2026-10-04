import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkHold, clientIp, publicCreateHold, publicGetHold } from "@revio/booking";
import { forTenant } from "@revio/db";
import { guestPublishableKey } from "@revio/payments";
import { parseRoomParties, parseRoomPicks, serializeRoomParties, serializeRoomPicks } from "@revio/core";
import { BOOKING_SESSION_COOKIE } from "@/middleware";
import type { PublicProperty } from "@/lib/property";
import { isValidISO, nightsBetween } from "@/lib/dates";
import { serverKit } from "@/lib/i18n/server";
import { termsWords } from "@/lib/i18n/kit";
import { groupPayNowMinor, groupQuery, groupTotalMinor, loadGroup } from "@/lib/group";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { StepBar } from "@/components/StepBar";
import { BookingForm } from "@/components/BookingForm";

/**
 * Step 3 for several rooms: every room held, re-priced for its own party, one form for the guest and
 * one payment for the whole booking. Each room becomes its own reservation (`bookingGroupId`), so each
 * can later be cancelled, changed and billed on its own terms.
 */
export async function GroupBook({ property, sp }: { property: PublicProperty; sp: Record<string, string | undefined> }) {
  const slug = property.slug;
  const checkIn = isValidISO(sp.checkIn) ? sp.checkIn : null;
  const checkOut = isValidISO(sp.checkOut) ? sp.checkOut : null;
  const rooms = parseRoomParties(sp.rooms);
  const picks = parseRoomPicks(sp.sel);
  if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) < 1) redirect(`/${slug}/search`);
  const back = `/${slug}/search?${groupQuery({ checkIn, checkOut, rooms })}`;
  if (picks.length !== rooms.length) redirect(back);

  const ip = clientIp(await headers());
  const items = await loadGroup(property, ip, { checkIn, checkOut, rooms, picks });
  // A room went while they chose the others: back to choosing, with nothing picked.
  if (!items) redirect(back);

  // Hold every room — reusing the ones in the URL, so a refresh never takes a second set.
  const db = forTenant(property.tenantId);
  const given = (sp.holds ?? "").split(",").filter(Boolean);
  const live = given.length === items!.length
    ? await Promise.all(given.map((id) => publicGetHold(db, property.id, id)))
    : [];
  const holds = live.length === items!.length && live.every(Boolean) ? live.map((h) => h!) : null;
  if (!holds) {
    if (!checkHold(ip, property.id).ok) redirect(back);
    const sessionId = (await cookies()).get(BOOKING_SESSION_COOKIE)?.value ?? null;
    const made: string[] = [];
    for (const it of items!) {
      const created = await publicCreateHold(db, { ...property, id: property.id }, {
        checkIn, checkOut, guests: it.party.adults, childAges: it.party.childAges, roomTypeId: it.pick.roomTypeId,
      }, sessionId);
      if (created.error || !created.hold) redirect(back);
      made.push(created.hold.id);
    }
    redirect(`/${slug}/book?${groupQuery({ checkIn, checkOut, rooms, picks })}&holds=${made.join(",")}`);
  }

  const kit = await serverKit(property);
  const { s, fmtDay, money } = kit;
  const nights = nightsBetween(checkIn, checkOut);
  const currency = items![0]!.plan.currency;
  const total = groupTotalMinor(items!);
  const payNow = groupPayNowMinor(items!);
  const key = guestPublishableKey();
  const card = property.paymentReady && key ? { publishableKey: key, account: property.paymentAccountId, currency, locale: kit.locale } : null;
  // Each room's own terms, said per room — two rates can have two different cancellation rules.
  const termsLines = items!.map((it, i) => {
    const w = it.plan.terms ? termsWords(kit, it.plan.terms, it.plan.currency) : null;
    return `${s.bar.roomN(i + 1)} · ${it.plan.name}: ${w ? `${w.cancellation} · ${w.payment}` : it.plan.cancellationPolicy ?? "—"}`;
  });
  const earliest = holds.reduce((m, h) => (h.expiresAt < m ? h.expiresAt : m), holds[0]!.expiresAt);
  const first = items![0]!;
  const totalGuests = rooms.reduce((n, r) => n + r.adults + r.childAges.length, 0);

  return (
    <>
      <PropertyHeader property={property} />
      <main className="mx-auto w-full max-w-[62rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar current="Details" backHref={back} s={s.steps} />
        <h1 className="display mt-6 text-[1.85rem] sm:mt-8 sm:text-[2.4rem]">{s.book.title}</h1>
        <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
          {fmtDay(checkIn)} — {fmtDay(checkOut)} · {s.group.summary(items!.length)} · {s.book.summary(nights, totalGuests)}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_21rem] lg:items-start">
          <BookingForm
            stay={{
              slug, checkIn, checkOut, guests: first.party.adults, ages: first.party.childAges.join(","),
              roomTypeId: first.pick.roomTypeId, ratePlanId: first.pick.ratePlanId, holdId: holds[0]!.id,
            }}
            group={{ rooms: serializeRoomParties(rooms), sel: serializeRoomPicks(picks), holds: holds.map((h) => h.id).join(",") }}
            fixedPayNowMinor={payNow}
            cancellationPolicy={null}
            termsDetails={termsLines}
            card={card}
            expiresAt={earliest.toISOString()}
            paymentReady={property.paymentReady}
            extras={[]}
            nights={nights}
            currency={currency}
          />

          <aside className="card-raised order-first overflow-hidden lg:order-none lg:sticky lg:top-5">
            <div className="p-5">
              <h2 className="display text-[1.15rem]">{s.group.title}</h2>
              <ol className="mt-3 space-y-3">
                {items!.map((it, i) => (
                  <li key={i} className="border-t pt-3 text-[13px] first:border-t-0 first:pt-0" style={{ borderColor: "hsl(var(--line))" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{s.bar.roomN(i + 1)} · {it.option.name}</span>
                      <span className="nums font-semibold">{money(it.plan.totalMinor, it.plan.currency)}</span>
                    </div>
                    <p style={{ color: "hsl(var(--ink-soft))" }}>
                      {it.plan.name} · {s.bar.party(it.party.adults, it.party.childAges.length)}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-baseline justify-between border-t pt-3" style={{ borderColor: "hsl(var(--line))" }}>
                <span className="text-[13.5px] font-semibold">{s.group.roomsTotal}</span>
                <span className="price text-[1.5rem]">{money(total, currency)}</span>
              </div>
              {card && payNow > 0 && (
                <p className="mt-1 text-right text-[12.5px]" style={{ color: "hsl(var(--ink-soft))" }}>{s.book.payNowBold(money(payNow, currency))}</p>
              )}
            </div>
          </aside>
        </div>
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
