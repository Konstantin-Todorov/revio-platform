import { notFound } from "next/navigation";
import { Clock, MapPin, Phone } from "lucide-react";
import { getPublicProperty } from "@/lib/property";
import { SearchBar } from "@/components/SearchBar";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { TrustRow } from "@/components/TrustRow";

export const dynamic = "force-dynamic";

/**
 * The hotel's front door.
 *
 * One job: get the guest to a date range without making them think. The search bar is the only
 * interactive thing above the fold, and it sits centred in the hero deliberately — a guest who
 * lands here should never have to work out where the booking starts.
 *
 * Everything below it answers "why book here rather than on Booking.com", and every claim is one we
 * can actually keep. Fake urgency is how OTAs became distrusted; it would poison the one claim on
 * this page that is genuinely unusual.
 */
export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  return (
    <>
      <PropertyHeader property={property} />

      <main>
        <section className="relative overflow-hidden">
          {/* A wash of the hotel's own colour, fading into the page. It is the only large area of
              brand on the site, which is what lets a navy and a gold both look deliberate here. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(130% 90% at 50% -10%, hsl(var(--brand-wash)) 0%, hsl(var(--ground)) 62%)",
            }}
          />

          <div className="relative mx-auto w-full max-w-[72rem] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-24">
            <div className="mx-auto max-w-[46rem] text-center">
              <p className="eyebrow rise" style={{ animationDelay: "40ms" }}>
                Official booking · {property.name}
              </p>
              <h1 className="display rise mt-4 text-[2.4rem] sm:text-[3.75rem]" style={{ animationDelay: "100ms" }}>
                Book direct. <span style={{ color: "hsl(var(--brand-text))" }}>Pay less.</span>
              </h1>
              <p
                className="rise mx-auto mt-5 max-w-[46ch] text-[15.5px] leading-relaxed sm:text-[17px]"
                style={{ animationDelay: "160ms", color: "hsl(var(--ink-soft))" }}
              >
                No commission goes to a travel site, so the rate you see is the one the hotel
                actually wants to give you — with taxes and fees already in the number.
              </p>
            </div>

            <div className="rise mx-auto mt-10 max-w-[58rem] sm:mt-12" style={{ animationDelay: "220ms" }}>
              <SearchBar slug={property.slug} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[72rem] px-5 sm:px-8">
          <div className="rise" style={{ animationDelay: "300ms" }}>
            <TrustRow checkInTime={property.checkInTime} checkOutTime={property.checkOutTime} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[72rem] px-5 pb-20 pt-12 sm:px-8">
          <h2 className="display text-[1.5rem]">Good to know</h2>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact icon={<Clock size={16} aria-hidden />} term="Check-in & check-out">
              From {property.checkInTime}, out by {property.checkOutTime}
            </Fact>
            {property.address && (
              <Fact icon={<MapPin size={16} aria-hidden />} term="Where you'll stay">
                {property.address}
              </Fact>
            )}
            {property.phone && (
              <Fact icon={<Phone size={16} aria-hidden />} term="Prefer to talk to someone?">
                <a href={`tel:${property.phone.replace(/\s+/g, "")}`} className="link-quiet font-semibold">
                  {property.phone}
                </a>
              </Fact>
            )}
          </dl>
        </section>
      </main>

      <PropertyFooter property={property} />
    </>
  );
}

function Fact({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <dt className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "hsl(var(--ink-faint))" }}>
        <span style={{ color: "hsl(var(--brand-text))" }}>{icon}</span>
        {term}
      </dt>
      <dd className="mt-2 text-[14px] leading-relaxed">{children}</dd>
    </div>
  );
}
