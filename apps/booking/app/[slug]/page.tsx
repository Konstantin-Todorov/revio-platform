import { notFound } from "next/navigation";
import { getPublicProperty } from "@/lib/property";
import { SearchForm } from "@/components/SearchForm";
import { PropertyHeader } from "@/components/PropertyHeader";
import { TrustRow } from "@/components/TrustRow";

export const dynamic = "force-dynamic";

/**
 * The hotel's front door.
 *
 * One job: get the guest to a date range without making them think. Everything below the search bar
 * exists to answer "why book here rather than on Booking.com" — and every claim on it is one we can
 * actually keep, because fake urgency is how OTAs became distrusted.
 */
export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  return (
    <main className="mx-auto w-full max-w-[68rem] px-5 pb-24 pt-8 sm:px-8 sm:pt-14">
      <PropertyHeader property={property} />

      <section className="mt-14 sm:mt-24">
        <p className="eyebrow rise" style={{ animationDelay: "60ms" }}>
          Book direct
        </p>
        <h1
          className="display rise mt-3 max-w-[16ch] text-[2.6rem] sm:text-[4.25rem]"
          style={{ animationDelay: "120ms" }}
        >
          Reserve your stay
          <span className="block" style={{ color: "hsl(var(--brand-text))" }}>
            at the best rate.
          </span>
        </h1>
        <p
          className="rise mt-5 max-w-[46ch] text-[15px] leading-relaxed"
          style={{ animationDelay: "180ms", color: "hsl(var(--ink-soft))" }}
        >
          Booking here costs you nothing extra and pays no commission to a travel site — so the rate
          you see is the rate the hotel actually wants to give you.
        </p>

        <div className="rise mt-9 sm:mt-11" style={{ animationDelay: "240ms" }}>
          <SearchForm slug={property.slug} />
        </div>

        <div className="rise mt-10" style={{ animationDelay: "320ms" }}>
          <TrustRow checkInTime={property.checkInTime} checkOutTime={property.checkOutTime} />
        </div>
      </section>

      <footer className="mt-28 border-t pt-8 text-[13px] rule" style={{ color: "hsl(var(--ink-faint))" }}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-semibold" style={{ color: "hsl(var(--ink-soft))" }}>
              {property.name}
            </p>
            {property.address && <p className="mt-1 max-w-[32ch]">{property.address}</p>}
            <p className="mt-1 flex flex-wrap gap-x-4">
              {property.phone && <span>{property.phone}</span>}
              {property.contactEmail && <span>{property.contactEmail}</span>}
            </p>
          </div>
          <p className="text-[12px]">
            Check-in from {property.checkInTime} · Check-out by {property.checkOutTime}
          </p>
        </div>
      </footer>
    </main>
  );
}
