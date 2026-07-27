import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarSearch, Phone } from "lucide-react";
import { clientIp } from "@revio/booking";
import { getObjectStore } from "@revio/storage";
import { getPublicProperty, type PublicProperty } from "@/lib/property";
import { searchAvailability } from "@/lib/availability";
import { addDays, fmtDay, isValidISO, nightsBetween, todayISO } from "@/lib/dates";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { RoomOption } from "@/components/RoomOption";
import { SearchBar } from "@/components/SearchBar";
import { StepBar } from "@/components/StepBar";

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
    return (
      <Notice property={property} title="No rooms free for those dates">
        The hotel may be full, or those nights may not be open for booking yet. These nearby dates
        are worth a try.
        <AlternativeDates slug={property.slug} q={q} nights={nights} />
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
 * A dead end is the worst thing a booking engine can produce, and "sold out" is the most common one.
 *
 * Shifting the same-length stay by a few days is the search a guest would run next by hand, so we
 * run it for them. These are plain links, not a second round of queries — the point is to keep them
 * moving, not to pre-compute every answer.
 */
function AlternativeDates({
  slug,
  q,
  nights,
}: {
  slug: string;
  q: { checkIn: string; checkOut: string; guests: number };
  nights: number;
}) {
  const today = todayISO();
  const shifts = [-3, -2, -1, 1, 2, 3]
    .map((by) => ({ checkIn: addDays(q.checkIn, by), checkOut: addDays(q.checkOut, by), guests: q.guests }))
    .filter((alt) => alt.checkIn >= today);

  if (shifts.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {shifts.map((alt) => (
        <a
          key={alt.checkIn}
          href={searchHref(slug, alt)}
          className="btn btn-outline min-h-[40px] px-3.5 text-[13px] font-medium"
        >
          {fmtDay(alt.checkIn)}
          <span style={{ color: "hsl(var(--ink-faint))" }}>
            · {nights}
            {nights === 1 ? " night" : " nights"}
          </span>
        </a>
      ))}
    </div>
  );
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
          <div className="grid sm:grid-cols-[minmax(0,13.5rem)_1fr]">
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
