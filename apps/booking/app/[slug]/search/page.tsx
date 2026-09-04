import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarSearch, Phone } from "lucide-react";
import { clientIp, type AlternativeStay } from "@revio/booking";
import { getObjectStore } from "@revio/storage";
import { getPublicProperty, type PublicProperty } from "@/lib/property";
import { searchAvailability } from "@/lib/availability";
import { fmtDay, isValidISO, money, nightsBetween } from "@/lib/dates";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { RoomOption } from "@/components/RoomOption";
import { SearchBar } from "@/components/SearchBar";
import { StepBar } from "@/components/StepBar";
import { WaitlistJoin } from "@/components/WaitlistJoin";

export const dynamic = "force-dynamic";

interface Query {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
}

/** A guest can type anything into a URL; treat every parameter as hostile until parsed. */
function parseQuery(sp: { checkIn?: string; checkOut?: string; guests?: string }): Query {
  const guests = Number.parseInt(sp.guests ?? "2", 10);
  return {
    checkIn: isValidISO(sp.checkIn) ? sp.checkIn : null,
    checkOut: isValidISO(sp.checkOut) ? sp.checkOut : null,
    guests: Number.isFinite(guests) && guests >= 1 && guests <= 10 ? guests : 2,
  };
}

function searchHref(slug: string, q: { checkIn: string; checkOut: string; guests: number }): string {
  return `/${slug}/search?checkIn=${q.checkIn}&checkOut=${q.checkOut}&guests=${q.guests}`;
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const q = parseQuery(sp);
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
            defaultGuests={q.guests}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-[72rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar current="Room" backHref={`/${property.slug}`} />

        <div className="mt-6 sm:mt-8">
          {valid ? (
            <>
              <h1 className="display text-[1.85rem] sm:text-[2.4rem]">
                {fmtDay(q.checkIn!)} — {fmtDay(q.checkOut!)}
              </h1>
              <p className="nums mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
                {nights} {nights === 1 ? "night" : "nights"} · {q.guests}{" "}
                {q.guests === 1 ? "guest" : "guests"} · every price includes taxes and fees
              </p>
            </>
          ) : (
            <>
              <h1 className="display text-[1.85rem] sm:text-[2.4rem]">Choose your dates</h1>
              <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
                Pick a check-in and a check-out above to see what's free and what it costs.
              </p>
            </>
          )}
        </div>

        <div className="mt-7">
          {valid ? (
            // Keyed on the query so changing dates shows the skeleton again rather than leaving the
            // previous stay's prices on screen while the new ones are fetched.
            <Suspense key={`${q.checkIn}-${q.checkOut}-${q.guests}`} fallback={<ResultsSkeleton />}>
              <Results
                property={property}
                q={{ checkIn: q.checkIn!, checkOut: q.checkOut!, guests: q.guests }}
                nights={nights}
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
}: {
  property: PublicProperty;
  q: { checkIn: string; checkOut: string; guests: number };
  nights: number;
}) {
  const [outcome, store] = await Promise.all([
    searchAvailability(property, clientIp(await headers()), q),
    getObjectStore(),
  ]);
  const options = outcome.options ?? [];
  const mediaUrl = (key: string) => store.publicUrl(key);

  if (outcome.error) return <Notice property={property}>{outcome.error}</Notice>;

  if (options.length === 0) {
    const alternatives = outcome.alternatives ?? [];
    return (
      <Notice
        property={property}
        title={alternatives.length ? "Those dates are full — but these are free" : "No rooms free for those dates"}
      >
        {alternatives.length ? (
          <>
            Same {nights === 1 ? "night" : `${nights} nights`}, moved a little. We checked each one —
            these have rooms right now.
            <AlternativeDates slug={property.slug} guests={q.guests} alternatives={alternatives} />
          </>
        ) : (
          <>
            We also checked the week either side and could not find {nights}{" "}
            {nights === 1 ? "night" : "nights"} anywhere near these dates. The hotel may be full, or
            those nights may not be open for booking yet.
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

  return (
    <>
      <p className="mb-4 text-[13px] font-semibold" style={{ color: "hsl(var(--ink-soft))" }}>
        {options.length} {options.length === 1 ? "room type" : "room types"} available
      </p>
      <div className="space-y-4">
        {options.map((option) => (
          <RoomOption
            key={option.roomTypeId}
            option={option}
            nights={nights}
            slug={property.slug}
            checkIn={q.checkIn}
            checkOut={q.checkOut}
            guests={q.guests}
            mediaUrl={mediaUrl}
          />
        ))}
      </div>
      <p className="mt-8 text-[12.5px] leading-relaxed" style={{ color: "hsl(var(--ink-faint))" }}>
        Prices are for the whole stay and include all taxes and fees. Nothing is charged when you
        book — your card only guarantees the room.
      </p>
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
  alternatives,
}: {
  slug: string;
  guests: number;
  alternatives: AlternativeStay[];
}) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {alternatives.map((alt) => (
        <a
          key={alt.checkIn}
          href={searchHref(slug, { checkIn: alt.checkIn, checkOut: alt.checkOut, guests })}
          className="card flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:border-[hsl(var(--brand))]"
        >
          <span className="min-w-0">
            <span className="block text-[13.5px] font-bold">
              {fmtDay(alt.checkIn)} — {fmtDay(alt.checkOut)}
            </span>
            <span className="block text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
              {shiftLabel(alt.offsetDays)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="price block text-[15px]">{money(alt.fromMinor, alt.currency)}</span>
            <span className="block text-[11px]" style={{ color: "hsl(var(--ink-faint))" }}>
              total
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}

/** "2 days earlier" reads faster than a second date range the guest has to diff themselves. */
function shiftLabel(offsetDays: number): string {
  const n = Math.abs(offsetDays);
  const unit = n === 1 ? "day" : "days";
  return offsetDays < 0 ? `${n} ${unit} earlier` : `${n} ${unit} later`;
}

function Notice({
  property,
  title,
  children,
}: {
  property: PublicProperty;
  title?: string;
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
          Call the hotel — {property.phone}
        </a>
      )}
    </div>
  );
}

/** Holds the exact shape of a result card, so nothing on the page moves when prices arrive. */
function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Checking availability">
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
