import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clientIp } from "@revio/booking";
import { getPublicProperty } from "@/lib/property";
import { searchAvailability, nightsBetween, prettyDate } from "@/lib/availability";
import { PropertyHeader } from "@/components/PropertyHeader";
import { RoomOption } from "@/components/RoomOption";
import { SearchForm } from "@/components/SearchForm";

export const dynamic = "force-dynamic";

/** A guest can type anything into a URL; treat every parameter as hostile until parsed. */
function parseQuery(sp: { checkIn?: string; checkOut?: string; guests?: string }) {
  const dateish = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const guests = Number.parseInt(sp.guests ?? "2", 10);
  return {
    checkIn: dateish(sp.checkIn),
    checkOut: dateish(sp.checkOut),
    guests: Number.isFinite(guests) && guests >= 1 && guests <= 12 ? guests : 2,
  };
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

  const outcome =
    q.checkIn && q.checkOut && nights > 0
      ? await searchAvailability(property, clientIp(await headers()), {
          checkIn: q.checkIn,
          checkOut: q.checkOut,
          guests: q.guests,
        })
      : { error: "Choose your dates to see what's available." };

  const options = outcome.options ?? [];

  return (
    <main className="mx-auto w-full max-w-[68rem] px-5 pb-24 pt-8 sm:px-8 sm:pt-14">
      <PropertyHeader property={property} />

      <div className="mt-12 sm:mt-16">
        <Link href={`/${property.slug}`} className="eyebrow hover:underline">
          ← Back
        </Link>

        {q.checkIn && q.checkOut && nights > 0 ? (
          <>
            <h1 className="display rise mt-4 text-[2rem] sm:text-[2.75rem]">
              {prettyDate(q.checkIn)} — {prettyDate(q.checkOut)}
            </h1>
            <p className="mt-2 text-[14px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {nights} {nights === 1 ? "night" : "nights"} · {q.guests}{" "}
              {q.guests === 1 ? "guest" : "guests"}
              {options.length > 0 && <> · every price below includes taxes and fees</>}
            </p>
          </>
        ) : (
          <h1 className="display mt-4 text-[2rem] sm:text-[2.75rem]">Choose your dates</h1>
        )}

        {/* Changing dates is the most common action here, so the form stays on the page. */}
        <div className="rise mt-7">
          <SearchForm
            slug={property.slug}
            {...(q.checkIn ? { defaultCheckIn: q.checkIn } : {})}
            {...(q.checkOut ? { defaultCheckOut: q.checkOut } : {})}
            defaultGuests={q.guests}
          />
        </div>
      </div>

      <section className="mt-10 space-y-4">
        {outcome.error && (
          <div className="card rounded-xl px-6 py-8 text-center">
            <p className="text-[14.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {outcome.error}
            </p>
          </div>
        )}

        {!outcome.error && options.length === 0 && (
          <div className="card rounded-xl px-6 py-12 text-center">
            <h2 className="display text-[1.4rem]">No rooms available for those dates</h2>
            <p
              className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed"
              style={{ color: "hsl(var(--ink-soft))" }}
            >
              The hotel may be full, or those nights may not be open for booking yet. Try shifting
              your dates by a day or two{property.phone ? ", or call the hotel directly." : "."}
            </p>
            {property.phone && (
              <p className="mt-4 text-[14px] font-semibold" style={{ color: "hsl(var(--brand-text))" }}>
                {property.phone}
              </p>
            )}
          </div>
        )}

        {options.map((option) => (
          <RoomOption
            key={option.roomTypeId}
            option={option}
            nights={nights}
            slug={property.slug}
            checkIn={q.checkIn!}
            checkOut={q.checkOut!}
            guests={q.guests}
          />
        ))}
      </section>

      {options.length > 0 && (
        <p className="mt-8 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
          Prices are for the whole stay and include all taxes and fees. Nothing is charged when you
          book — your card only guarantees the room.
        </p>
      )}
    </main>
  );
}
