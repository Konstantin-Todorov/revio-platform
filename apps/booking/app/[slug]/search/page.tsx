import { normalisePromo, parseChildAges, parseRoomParties, parseRoomPicks, type RoomParty, type RoomPick } from "@revio/core";
import { groupQuery } from "@/lib/group";
import { GroupSteps } from "@/components/GroupSteps";
import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarSearch, Phone } from "lucide-react";
import { clientIp, type AlternativeStay } from "@revio/booking";
import { getObjectStore } from "@revio/storage";
import { getPublicProperty, type PublicProperty } from "@/lib/property";
import { searchAvailability } from "@/lib/availability";
import { isValidISO, nightsBetween } from "@/lib/dates";
import { serverKit } from "@/lib/i18n/server";
import type { GuestKit } from "@/lib/i18n/kit";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { RoomOption } from "@/components/RoomOption";
import { StickyRoomBar } from "@/components/StickyRoomBar";
import { SearchBar } from "@/components/SearchBar";
import { StepBar } from "@/components/StepBar";
import { WaitlistJoin } from "@/components/WaitlistJoin";

export const dynamic = "force-dynamic";

interface Query {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  /** Children's ages (`ages=4,7`) — priced and fitted by the hotel's age bands. */
  childAges: number[];
  /** A promo code (`promo=SUMMER10`). */
  promo: string;
}

/** A guest can type anything into a URL; treat every parameter as hostile until parsed. */
function parseQuery(sp: { checkIn?: string; checkOut?: string; guests?: string; ages?: string; promo?: string }): Query {
  const guests = Number.parseInt(sp.guests ?? "2", 10);
  return {
    checkIn: isValidISO(sp.checkIn) ? sp.checkIn : null,
    checkOut: isValidISO(sp.checkOut) ? sp.checkOut : null,
    guests: Number.isFinite(guests) && guests >= 1 && guests <= 10 ? guests : 2,
    childAges: parseChildAges(sp.ages),
    promo: normalisePromo(sp.promo),
  };
}

function searchHref(slug: string, q: { checkIn: string; checkOut: string; guests: number; childAges?: number[]; promo?: string }): string {
  const ages = q.childAges?.length ? `&ages=${q.childAges.join(",")}` : "";
  const promo = q.promo ? `&promo=${encodeURIComponent(q.promo)}` : "";
  return `/${slug}/search?checkIn=${q.checkIn}&checkOut=${q.checkOut}&guests=${q.guests}${ages}${promo}`;
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; ages?: string; rooms?: string; sel?: string; promo?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const q = parseQuery(sp);
  /*
   * Several rooms: the guest chooses one room per slot, in order. The slot being chosen is the
   * number already picked; its own party drives this search. Once every slot has a room, on to the
   * booking step with all of them.
   */
  const rooms = parseRoomParties(sp.rooms);
  const multi = rooms.length > 1;
  const picks = multi ? parseRoomPicks(sp.sel).slice(0, rooms.length) : [];
  if (multi && q.checkIn && q.checkOut && picks.length === rooms.length) {
    redirect(`/${property.slug}/book?${groupQuery({ checkIn: q.checkIn, checkOut: q.checkOut, rooms, picks, promo: q.promo })}`);
  }
  if (multi) {
    const slot = rooms[picks.length]!;
    q.guests = slot.adults;
    q.childAges = slot.childAges;
  }
  const kit = await serverKit(property);
  const { s, fmtDay } = kit;
  const nights = q.checkIn && q.checkOut ? nightsBetween(q.checkIn, q.checkOut) : 0;
  const valid = !!q.checkIn && !!q.checkOut && nights > 0;

  return (
    <>
      <PropertyHeader property={property} />

      {/*
        The search bar stays pinned under the header for the whole results page. Changing dates is
        by far the most common thing a guest does here — sending them back to the previous screen to
        do it is how a two-minute booking becomes an abandoned one.
      */}
      <div
        className="sticky top-[60px] z-30 border-b"
        style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--ground))" }}
      >
        <div className="mx-auto w-full max-w-[72rem] px-5 py-3 sm:px-8">
          <SearchBar
            slug={property.slug}
            compact
            {...(q.checkIn ? { defaultCheckIn: q.checkIn } : {})}
            {...(q.checkOut ? { defaultCheckOut: q.checkOut } : {})}
            defaultGuests={multi ? rooms[0]!.adults : q.guests}
            defaultChildAges={multi ? rooms[0]!.childAges : q.childAges}
            defaultRooms={multi ? rooms : []}
            defaultPromo={q.promo}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-[72rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar current="Room" backHref={`/${property.slug}`} s={s.steps} />

        <div className="mt-6 sm:mt-8">
          {valid ? (
            <>
              <h1 className="display text-[1.85rem] sm:text-[2.4rem]">
                {fmtDay(q.checkIn!)} — {fmtDay(q.checkOut!)}
              </h1>
              <p className="nums mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
                {s.search.summary(nights, multi ? rooms.reduce((n, r) => n + r.adults + r.childAges.length, 0) : q.guests + q.childAges.length)}
              </p>
              {multi && (
                <GroupSteps
                  property={property}
                  rooms={rooms}
                  picks={picks}
                  checkIn={q.checkIn!}
                  checkOut={q.checkOut!}
                  promo={q.promo}
                  kit={kit}
                />
              )}
            </>
          ) : (
            <>
              <h1 className="display text-[1.85rem] sm:text-[2.4rem]">{s.search.chooseTitle}</h1>
              <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
                {s.search.chooseBody}
              </p>
            </>
          )}
        </div>

        <div className="mt-7">
          {valid ? (
            // Keyed on the query so changing dates shows the skeleton again rather than leaving the
            // previous stay's prices on screen while the new ones are fetched.
            <Suspense key={`${q.checkIn}-${q.checkOut}-${q.guests}-${q.childAges.join(".")}-${q.promo}`} fallback={<ResultsSkeleton label={s.search.checking} />}>
              <Results
                property={property}
                q={{ checkIn: q.checkIn!, checkOut: q.checkOut!, guests: q.guests, childAges: q.childAges, promo: q.promo }}
                group={multi ? { rooms, picks } : null}
                nights={nights}
                kit={kit}
              />
            </Suspense>
          ) : null}
        </div>
      </main>

      <PropertyFooter property={property} />
    </>
  );
}

async function Results({
  property,
  q,
  nights,
  kit,
  group = null,
}: {
  property: PublicProperty;
  q: { checkIn: string; checkOut: string; guests: number; childAges: number[]; promo: string };
  nights: number;
  kit: GuestKit;
  /** Several rooms: the slots and what is already picked for them. */
  group?: { rooms: RoomParty[]; picks: RoomPick[] } | null;
}) {
  const { s } = kit;
  const [outcome, store] = await Promise.all([
    searchAvailability(property, clientIp(await headers()), q),
    getObjectStore(),
  ]);
  /*
   * A type already picked for an earlier slot counts against this one — the last room is offered to
   * one slot, not to every slot. Each pick links back here with itself appended, until all are chosen.
   */
  const options = (outcome.options ?? [])
    .map((o) => group ? { ...o, remaining: o.remaining - group.picks.filter((p) => p.roomTypeId === o.roomTypeId).length } : o)
    .filter((o) => o.remaining >= 1);
  const pickHref = group
    ? (roomTypeId: string) => (ratePlanId: string) =>
        `/${property.slug}/search?${groupQuery({ checkIn: q.checkIn, checkOut: q.checkOut, rooms: group.rooms, picks: [...group.picks, { roomTypeId, ratePlanId }], promo: q.promo })}`
    : null;
  const mediaUrl = (key: string) => store.publicUrl(key);

  // Said in the guest's language, by what went wrong — never the engine's English sentence.
  if (outcome.error) {
    return <Notice property={property} callLabel={s.search.callHotel}>{outcome.rateLimited ? s.search.rateLimited : outcome.code ? s.errors.booking[outcome.code] : s.errors.generic}</Notice>;
  }

  if (options.length === 0) {
    const alternatives = outcome.alternatives ?? [];
    return (
      <Notice
        property={property}
        callLabel={s.search.callHotel}
        title={alternatives.length ? s.search.altTitle : s.search.noneTitle}
      >
        {alternatives.length ? (
          <>
            {s.search.altBody(nights)}
            <AlternativeDates slug={property.slug} guests={q.guests} childAges={q.childAges} promo={q.promo} alternatives={alternatives} kit={kit} />
          </>
        ) : (
          <>
            {s.search.noneBody(nights)}
          </>
        )}
        {/*
          Beside the alternatives, never instead of them — an alternative converts today, a waitlist
          converts maybe, and swapping a bookable room for a mailing list trades revenue for a list.
        */}
        <WaitlistJoin
          slug={property.slug}
          checkIn={q.checkIn}
          checkOut={q.checkOut}
          guests={q.guests}
          nights={nights}
        />
      </Notice>
    );
  }

  // The code the guest typed: applied, or why not — said before the prices, not discovered at checkout.
  const promoNote = outcome.promo
    ? outcome.promo.refusal
      ? { ok: false, text: s.promo.refusal[outcome.promo.refusal as keyof typeof s.promo.refusal](outcome.promo.code) }
      : { ok: true, text: s.promo.applied(outcome.promo.code) }
    : null;

  return (
    <>
      {promoNote && (
        <p className="mb-4 rounded-[var(--r-sm)] px-3.5 py-2.5 text-[13px] font-semibold" role="status"
           style={promoNote.ok ? { backgroundColor: "hsl(var(--positive) / 0.1)", color: "hsl(var(--positive))" } : { backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}>
          {promoNote.text}
        </p>
      )}
      <p className="mb-4 text-[13px] font-semibold" style={{ color: "hsl(var(--ink-soft))" }}>
        {s.search.available(options.length)}
      </p>
      <div className="space-y-5">
        {options.map((option) => (
          <RoomOption
            key={option.roomTypeId}
            option={option}
            nights={nights}
            slug={property.slug}
            checkIn={q.checkIn}
            checkOut={q.checkOut}
            guests={q.guests}
            childAges={q.childAges}
            promo={q.promo}
            {...(pickHref ? { pickHref: pickHref(option.roomTypeId) } : {})}
            mediaUrl={mediaUrl}
            kit={kit}
          />
        ))}
      </div>
      <p className="mt-8 pb-20 text-[12.5px] leading-relaxed sm:pb-0" style={{ color: "hsl(var(--ink-faint))" }}>
        {property.paymentReady ? s.search.footnote : s.search.footnoteRequest}
      </p>
      <StickyRoomBar selectLabel={s.room.stickySelect} totalLabel={s.room.stickyTotal} />
    </>
  );
}

/**
 * Nearby dates that are ACTUALLY free.
 *
 * Every chip here was really searched — the server ran the same availability function that will run
 * when the guest clicks it, so a chip cannot promise a room that is not there. That is the whole
 * difference between a helpful dead end and a second disappointment.
 *
 * The price is shown because "free" and "affordable" are different questions, and a guest deciding
 * whether to move their trip is asking both at once.
 */
function AlternativeDates({
  slug,
  guests,
  childAges,
  promo,
  alternatives,
  kit,
}: {
  slug: string;
  guests: number;
  childAges: number[];
  promo: string;
  alternatives: AlternativeStay[];
  kit: GuestKit;
}) {
  const { s, fmtDay, money } = kit;
  return (
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {alternatives.map((alt) => (
        <a
          key={alt.checkIn}
          href={searchHref(slug, { checkIn: alt.checkIn, checkOut: alt.checkOut, guests, childAges, promo })}
          className="card flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:border-[hsl(var(--brand))]"
        >
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold">
              {fmtDay(alt.checkIn)} — {fmtDay(alt.checkOut)}
            </span>
            <span className="block text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
              {alt.offsetDays < 0 ? s.search.earlier(-alt.offsetDays) : s.search.later(alt.offsetDays)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="price block text-[15px]">{money(alt.fromMinor, alt.currency)}</span>
            <span className="block text-[11px]" style={{ color: "hsl(var(--ink-faint))" }}>
              {s.search.total}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}

function Notice({
  property,
  title,
  callLabel,
  children,
}: {
  property: PublicProperty;
  title?: string;
  callLabel: (phone: string) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-raised px-6 py-12 text-center">
      <span
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}
      >
        <CalendarSearch size={19} aria-hidden />
      </span>
      {title && <h2 className="display mt-4 text-[1.4rem]">{title}</h2>}
      <div
        className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed"
        style={{ color: "hsl(var(--ink-soft))" }}
      >
        {children}
      </div>
      {property.phone && (
        <a
          href={`tel:${property.phone.replace(/\s+/g, "")}`}
          className="btn btn-ghost mx-auto mt-5 text-[13.5px] font-semibold"
          style={{ color: "hsl(var(--brand-text))" }}
        >
          <Phone size={15} aria-hidden />
          {callLabel(property.phone)}
        </a>
      )}
    </div>
  );
}

/** Holds the exact shape of a result card, so nothing on the page moves when prices arrive. */
function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label}>
      {[0, 1].map((i) => (
        <div key={i} className="card-raised overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,13.5rem)_1fr]">
            <div className="skel hidden min-h-[11rem] rounded-none sm:block" />
            <div className="p-5">
              <div className="skel h-6 w-2/5" />
              <div className="skel mt-3 h-4 w-1/4" />
              <div className="mt-6 flex items-end justify-between gap-6">
                <div className="flex-1">
                  <div className="skel h-4 w-1/3" />
                  <div className="skel mt-2.5 h-8 w-3/5" />
                </div>
                <div className="skel h-11 w-[9rem]" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
