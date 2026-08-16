import { notFound } from "next/navigation";
import { Clock, MapPin, Phone } from "lucide-react";
import { bookingPreset } from "@revio/core";
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

  const photo = property.hero;
  /*
   * A background photograph REPLACES the preset's hero treatment rather than layering on it.
   *
   * The preset's job is the neutrals and the shape of the whole page, and it keeps that job below
   * the fold. But its hero band is a *substitute* for imagery — a wash or a slab of the hotel's
   * colour, there precisely because most hotels have no photo here. Running both would put the
   * hotel's brand colour over their own photograph, which is the one combination neither choice was
   * designed for.
   */
  const hero = photo ? "image" : bookingPreset(property.preset).tokens.hero;
  const solid = hero === "solid";
  /** White text over the photo. `--brand-ink` is the ink for the brand FILL and is a different job. */
  const onPhoto = hero === "image";
  const reversed = solid || onPhoto;

  return (
    <>
      <PropertyHeader property={property} />

      <main>
        {/*
          NOT `overflow-hidden`. The search bar's calendar and guest popovers are absolutely
          positioned children of this section, and they extend past the hero band by design — a
          clipping container cut them off at the coloured edge, so the guest saw half a calendar.
          The decorative layer below is `inset-0`, so it is already bounded by the section and needs
          no clipping of its own.

          `z-20` is the other half of that fix, and it is not optional. The entry animation
          (`.rise`) uses a transform, and a transform creates a stacking context — so the cards in
          the sections BELOW became their own stacking contexts that paint after this one in DOM
          order, straight over an open calendar. The popover's own `z-50` could not reach them: it
          only ranks inside its own context. Raising the whole hero above its later siblings is what
          actually decides the order.
        */}
        <section className="relative z-20">
          {/* The preset decides how the hero reads. `solid` reverses the headline out of a full
              band of the hotel's colour; `wash` fades a tint of it into the page; `plain` leaves
              the search bar to carry the page alone. */}
          {photo && (
            <div aria-hidden className="absolute inset-0 overflow-hidden">
              {/*
                Deliberately an <img> and not a CSS background: this is the largest element on the
                page and therefore the LCP, and only a real element can carry `fetchPriority` and
                intrinsic dimensions. `width`/`height` reserve the band's aspect so the headline does
                not jump when the photo lands.

                No `alt` text and `aria-hidden`, because it says nothing a guest needs — the hotel's
                name is already in the header, the heading and the page title. Describing a decorative
                photograph to a screen reader is noise between them and the search bar.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a hotel-uploaded photo of unknown origin, already resized and re-encoded by us */}
              <img
                src={photo.url}
                alt=""
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
                style={{ objectPosition: `50% ${photo.focalY}%` }}
              />
              {/*
                The measured scrim. Its opacity is whatever it takes for white text to reach 4.5:1 on
                THIS photograph, plus however much darker the hotel asked for — never less.
              */}
              <div className="absolute inset-0 bg-black" style={{ opacity: photo.alpha }} />
              {/*
                A second, purely additive shade: a little more at the very top and bottom, so the
                band has weight under the sticky header and does not end on a hard horizontal edge.
                It only ever ADDS black, which is why it cannot undermine the measurement above —
                any gradient that lightened part of the image would have to be inside the maths.
              */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.28) 100%)",
                }}
              />
            </div>
          )}

          {!photo && hero !== "plain" && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={
                hero === "solid"
                  ? { backgroundColor: "hsl(var(--brand))" }
                  : {
                      background:
                        "radial-gradient(130% 90% at 50% -10%, hsl(var(--brand-wash)) 0%, hsl(var(--ground)) 62%)",
                    }
              }
            />
          )}

          {/* A photograph needs room to be one. In the preset heroes this padding is the whole band;
              with an image, too little height turns a hotel's view of the sea into a letterbox strip. */}
          <div
            className={`relative mx-auto w-full max-w-[72rem] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-24 ${
              photo ? "flex min-h-[30rem] flex-col justify-center sm:min-h-[34rem]" : ""
            }`}
          >
            <div className="mx-auto max-w-[46rem] text-center">
              <p
                className="eyebrow rise"
                style={{
                  animationDelay: "40ms",
                  ...(onPhoto
                    ? { color: "rgba(255,255,255,0.8)" }
                    : solid
                      ? { color: "hsl(var(--brand-ink) / 0.75)" }
                      : {}),
                }}
              >
                Official booking · {property.name}
              </p>
              <h1
                className="display rise mt-4 text-[2.4rem] sm:text-[3.75rem]"
                style={{
                  animationDelay: "100ms",
                  ...(onPhoto
                    ? { color: "#ffffff", textShadow: "0 1px 24px rgba(0,0,0,0.35)" }
                    : solid
                      ? { color: "hsl(var(--brand-ink))" }
                      : {}),
                }}
              >
                {property.headline}
              </h1>
              <p
                className="rise mx-auto mt-5 max-w-[46ch] text-[15.5px] leading-relaxed sm:text-[17px]"
                style={{
                  animationDelay: "160ms",
                  color: onPhoto
                    ? "rgba(255,255,255,0.92)"
                    : solid
                      ? "hsl(var(--brand-ink) / 0.85)"
                      : "hsl(var(--ink-soft))",
                  ...(onPhoto ? { textShadow: "0 1px 16px rgba(0,0,0,0.35)" } : {}),
                }}
              >
                {property.subheadline}
              </p>
            </div>

            <div className="rise mx-auto mt-10 w-full max-w-[58rem] sm:mt-12" style={{ animationDelay: "220ms" }}>
              <SearchBar slug={property.slug} onDark={reversed} />
            </div>
          </div>
        </section>

        {/*
          The hero ends on a hard edge in the Bold preset, so the content below needs real ground
          between it and the band. Without it the cards read as hanging off the hero rather than as
          the next section, which is the "two unrelated slabs" look.
        */}
        {property.showTrust && (
          <section className="mx-auto w-full max-w-[72rem] px-5 pt-12 sm:px-8 sm:pt-16">
            <div className="rise" style={{ animationDelay: "300ms" }}>
              <TrustRow checkInTime={property.checkInTime} checkOutTime={property.checkOutTime} />
            </div>
          </section>
        )}

        <section className="mx-auto w-full max-w-[72rem] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
          <h2 className="display text-[1.5rem]">Good to know</h2>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact icon={<Clock size={17} strokeWidth={2} aria-hidden />} term="Check-in & check-out">
              From {property.checkInTime}, out by {property.checkOutTime}
            </Fact>
            {property.address && (
              <Fact icon={<MapPin size={17} strokeWidth={2} aria-hidden />} term="Where you'll stay">
                {property.address}
              </Fact>
            )}
            {property.phone && (
              <Fact icon={<Phone size={17} strokeWidth={2} aria-hidden />} term="Prefer to talk to someone?">
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

/**
 * Deliberately the same shape as a TrustRow card — same padding, same icon chip, same rhythm.
 * Two informational rows sitting one above the other in two different treatments is what makes a
 * page look assembled rather than designed.
 */
function Fact({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <dt>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}
        >
          {icon}
        </span>
        <span className="mt-3.5 block text-[12.5px] font-semibold" style={{ color: "hsl(var(--ink-faint))" }}>
          {term}
        </span>
      </dt>
      <dd className="mt-1.5 text-[14px] leading-relaxed">{children}</dd>
    </div>
  );
}
