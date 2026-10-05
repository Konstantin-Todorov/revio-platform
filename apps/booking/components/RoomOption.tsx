import type { PublicPlanQuote, PublicRoomOption } from "@revio/booking";
import { BedDouble, ChevronDown, Coffee, CreditCard, Expand, Images, ShieldCheck, Sparkles, Users } from "lucide-react";
import { BED_SETUP_BY_KEY, BED_SETUP_ICON_BY_KEY, headlineAmenities } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import { termsWords, type GuestKit } from "@/lib/i18n/kit";
import { RoomPhoto } from "./RoomPhoto";
import { RoomDetail, RoomDetailOpen, RoomDetailTrigger } from "./RoomDetail";

/** Rates shown before "More rates" — enough to compare the usual choices (cheapest, refundable,
 *  breakfast) without a hotel's whole rate sheet becoming the page. */
const OPEN_RATES = 3;

/**
 * One room type and its rates — the shape Booking.com and Expedia taught every guest.
 *
 * The ROOM is described once: photograph, name, size, beds, the amenities that set it apart. The
 * RATES are compact rows beneath it, each saying the three things a guest compares rates by — what
 * is included, what leaves their card today, whether they can change their mind — with the total on
 * the right and the button beside it. A rate used to be a block the height of a phone screen, with a
 * grey breakdown box, a big price and a button stacked under each other; four of those made a room
 * card two screens tall and turned choosing into scrolling.
 *
 * The number is still the ALL-IN total for the stay. What it includes beyond the room (a city tax)
 * is said in one short line under it, never hidden behind a tooltip.
 *
 * The photograph opens the room's details and gallery — the first thing anyone taps.
 */
export function RoomOption({
  option, nights, slug, checkIn, checkOut, guests, childAges = [], promo = "", pickHref, mediaUrl, kit,
}: {
  /** The promo code, carried to the booking step. */
  promo?: string;
  /** Several rooms: choosing a rate picks it for the current slot instead of going to the form. */
  pickHref?: (ratePlanId: string) => string;
  /** Children's ages, carried to the booking step so it prices the same party. */
  childAges?: number[];
  /** The guest's language — words, room-content labels and money. */
  kit: GuestKit;
  option: PublicRoomOption;
  nights: number;
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Object key → URL. Injected because only the app knows whether a bucket or our route serves it. */
  mediaUrl: (key: string) => string;
}) {
  // Cheapest first — the rate most guests want, and the fairest comparison against an OTA listing.
  const plans = [...option.plans].sort((a, b) => a.totalMinor - b.totalMinor);
  const best = plans[0];
  if (!best) return null;
  const shown = plans.slice(0, OPEN_RATES);
  const more = plans.slice(OPEN_RATES);

  // Cover = lowest sortOrder, which is exactly what the hotel dragged to the front.
  const cover = option.photos[0];
  const headline = headlineAmenities(option.amenities);
  const { s, room, money } = kit;
  const hasDetail = option.photos.length > 0 || !!option.description || option.amenities.length > 0;

  const href = (plan: PublicPlanQuote) => pickHref ? pickHref(plan.ratePlanId) :
    `/${slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}${childAges.length ? `&ages=${childAges.join(",")}` : ""}${promo ? `&promo=${encodeURIComponent(promo)}` : ""}&roomTypeId=${option.roomTypeId}&ratePlanId=${plan.ratePlanId}`;
  const row = (plan: PublicPlanQuote, i: number) => (
    <RateRow key={plan.ratePlanId} plan={plan} nights={nights} href={href(plan)} best={i === 0 && plans.length > 1} kit={kit} />
  );

  const media = cover ? (
    <>
      <RoomPhoto src={mediaUrl(cover.thumbKey)} alt={cover.alt || s.room.photoAlt(option.name)} />
      <span
        className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
        style={{ backgroundColor: "hsl(var(--ink) / 0.66)", color: "#fff" }}
      >
        {option.photos.length > 1 ? <Images size={12} aria-hidden /> : <Expand size={12} aria-hidden />}
        {option.photos.length > 1 ? option.photos.length : s.room.details}
      </span>
    </>
  ) : (
    /* No photo is a normal state, not a failure: a hotel can go live before its photo shoot. */
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "linear-gradient(150deg, hsl(var(--brand-wash)), hsl(var(--brand-soft) / 0.65))" }}
    >
      <BedDouble size={30} strokeWidth={1.4} style={{ color: "hsl(var(--brand-text) / 0.35)" }} />
    </div>
  );

  const card = (
    <article
      className="card-raised overflow-hidden"
      data-room-card
      data-room-name={option.name}
      data-room-total={money(best.totalMinor, best.currency)}
      data-room-href={href(best)}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,19rem)_1fr]">
        {/* The photograph: on top on a phone (a guest chooses a room by looking at it), a column on
            a wider screen. It fills its box — a centred crop keeps the bed and the window. */}
        {cover && hasDetail ? (
          <RoomDetailOpen
            photo={0}
            label={s.room.detailsWithPhotos(option.photos.length)}
            className="group relative block aspect-[16/10] w-full overflow-hidden text-left md:aspect-auto md:min-h-[15rem]"
          >
            <span className="absolute inset-0 block transition-transform duration-500 group-hover:scale-[1.03]">{media}</span>
          </RoomDetailOpen>
        ) : (
          <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-auto md:min-h-[12rem]" aria-hidden={!cover}>
            {media}
          </div>
        )}

        <div className="flex min-w-0 flex-col">
          <header className="px-5 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-[1.3rem] leading-tight sm:text-[1.45rem]">{option.name}</h2>
              {/* Honest scarcity only — a real count, and only when it is genuinely low. */}
              {option.remaining <= 3 && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
                  style={{ backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}
                >
                  {option.remaining === 1 ? s.room.lastRoom : s.room.onlyLeft(option.remaining)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} aria-hidden /> {s.room.sleeps(option.maxGuests)}
              </span>
              {option.sizeSqm && <span>{option.sizeSqm} m²</span>}
              {option.bedSetup && BED_SETUP_BY_KEY[option.bedSetup] && (
                <span className="inline-flex items-center gap-1.5">
                  <AmenityIcon name={BED_SETUP_ICON_BY_KEY[option.bedSetup]} size={13} />
                  {room.bedSetups[option.bedSetup] ?? BED_SETUP_BY_KEY[option.bedSetup]}
                </span>
              )}
              {/* The amenities that set this room apart (`headlineAmenities` ranks a sea view above
                  air conditioning); the full list is one tap away in the details. */}
              {headline.map((a) => (
                <span key={a.key} className="inline-flex items-center gap-1.5">
                  <AmenityIcon name={a.icon} size={13} style={{ color: "hsl(var(--brand-text))" }} />
                  {room.amenities[a.key] ?? a.label}
                </span>
              ))}
            </div>
            {hasDetail && (
              <div className="mt-2">
                <RoomDetailTrigger label={option.photos.length > 1 ? s.room.detailsWithPhotos(option.photos.length) : s.room.details} />
              </div>
            )}
          </header>

          <div className="border-t" style={{ borderColor: "hsl(var(--line))" }}>
            <div data-best-rate>{row(best, 0)}</div>
            {shown.slice(1).map((p, i) => row(p, i + 1))}
          </div>

          {more.length > 0 && (
            /* Native <details>: no JavaScript, works before hydration, keyboard and screen readers free. */
            <details className="group border-t" style={{ borderColor: "hsl(var(--line))" }}>
              <summary
                className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-[hsl(var(--surface-sunk))] [&::-webkit-details-marker]:hidden"
                style={{ color: "hsl(var(--brand-text))" }}
              >
                <span>{s.room.otherRates(more.length)}</span>
                <ChevronDown size={16} aria-hidden className="transition-transform duration-200 group-open:rotate-180" />
              </summary>
              {more.map((p, i) => row(p, OPEN_RATES + i))}
            </details>
          )}
        </div>
      </div>
    </article>
  );

  if (!hasDetail) return card;
  return (
    // Keys resolved here, on the server — a function cannot cross into a client component.
    <RoomDetail
      option={option}
      fromLabel={s.room.from(money(best.totalMinor, best.currency))}
      rates={plans.map(row)}
      photos={option.photos.map((p) => ({ full: mediaUrl(p.fullKey), thumb: mediaUrl(p.thumbKey), alt: p.alt || "" }))}
    >
      {card}
    </RoomDetail>
  );
}

/**
 * One rate: what it includes and its terms on the left, the all-in total and the button on the right.
 * The same row in the card and in the room's details, so the two can never quote different prices.
 */
function RateRow({
  plan, nights, href, best = false, kit,
}: {
  kit: GuestKit;
  plan: PublicPlanQuote;
  nights: number;
  href: string;
  /** The cheapest rate, when there is something to be cheaper than. */
  best?: boolean;
}) {
  const { s, money } = kit;
  const words = plan.terms ? termsWords(kit, plan.terms, plan.currency) : null;
  const refundable = !!plan.terms?.freeCancelUntil;
  // What the total holds beyond the room, said in a few words under it: "incl. City tax €3".
  const extras = plan.charges.map((c) => `${c.name} ${money(c.amountMinor, plan.currency)}`).join(" · ");
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 border-t px-5 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
      style={{ borderColor: "hsl(var(--line))" }}
    >
      {/* What you get — on a phone it takes the full width, and price + button sit under it. */}
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-[14px] font-bold leading-snug">{plan.name}</h3>
          {best && (
            <span className="badge-brand">
              <Sparkles size={11} aria-hidden />
              {s.room.bestPrice}
            </span>
          )}
        </div>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
          {plan.mealPlan && (
            <li className="inline-flex items-center gap-1">
              <Coffee size={12.5} aria-hidden style={{ color: "hsl(var(--positive))" }} />
              {plan.mealPlan}
            </li>
          )}
          {words ? (
            <>
              <li className="inline-flex items-center gap-1" style={refundable ? { color: "hsl(var(--positive))", fontWeight: 600 } : undefined}>
                <ShieldCheck size={12.5} aria-hidden style={{ color: refundable ? "hsl(var(--positive))" : "hsl(var(--ink-faint))" }} />
                {words.cancellation}
              </li>
              <li className="inline-flex items-center gap-1">
                <CreditCard size={12.5} aria-hidden style={{ color: "hsl(var(--ink-faint))" }} />
                {words.payment}
              </li>
            </>
          ) : plan.cancellationPolicy && (
            <li className="inline-flex items-center gap-1">
              <ShieldCheck size={12.5} aria-hidden style={{ color: "hsl(var(--positive))" }} />
              {plan.cancellationPolicy}
            </li>
          )}
        </ul>
      </div>

      <div className="text-left sm:text-right">
        {/* The code's saving, said where the price is: the old total struck through, the code named. */}
        {plan.promo && (
          <div className="mb-1 flex items-center gap-1.5 sm:justify-end">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: "hsl(var(--positive) / 0.12)", color: "hsl(var(--positive))" }}>
              {s.promo.badge(plan.promo.code, plan.promo.percentOff)}
            </span>
            <span className="nums text-[12px] line-through" style={{ color: "hsl(var(--ink-faint))" }}>
              {money(plan.promo.originalTotalMinor, plan.currency)}
            </span>
          </div>
        )}
        <div className="price text-[1.3rem] leading-none sm:text-[1.4rem]">{money(plan.totalMinor, plan.currency)}</div>
        <div className="nums mt-1 text-[11.5px] leading-tight" style={{ color: "hsl(var(--ink-faint))" }}>
          {s.room.totalFor(nights)}
          {extras && <> · {s.room.includes(extras)}</>}
        </div>
      </div>

      <a href={href} className="btn btn-brand shrink-0 px-5">
        {s.room.select}
      </a>
    </div>
  );
}
