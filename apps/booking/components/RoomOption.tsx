import type { PublicPlanQuote, PublicRoomOption } from "@revio/booking";
import { BedDouble, ChevronDown, Coffee, Images, ShieldCheck, Sparkles, Users } from "lucide-react";
import { money } from "@/lib/dates";
import { RoomPhoto } from "./RoomPhoto";

/**
 * One room type and its rates.
 *
 * The headline number is the ALL-IN total for the whole stay. Per-night sits underneath in small
 * type — the opposite of an OTA, which leads with a nightly figure that grows once taxes appear.
 * Leading with the true total is the entire point of this product, so it gets the emphasis, and the
 * itemised breakdown sits beside it in plain sight rather than behind a tooltip.
 *
 * Only the cheapest rate is open. A hotel with four rate plans across four room types produces
 * sixteen near-identical rows, and a guest scrolling past all of them is doing the hotel's pricing
 * homework. The best price is the answer to the question they actually asked; the rest are there
 * for anyone who wants breakfast or a refundable rate, one click away.
 *
 * The media panel shows the room's cover photograph — the one the hotel dragged to the front of its
 * gallery. A hotel that has uploaded nothing gets a brand-tinted panel instead of a grey box, so it
 * can go live before its photo shoot and still look finished rather than broken.
 */
export function RoomOption({
  option, nights, slug, checkIn, checkOut, guests, mediaUrl,
}: {
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
  const [best, ...rest] = plans;
  if (!best) return null;

  // Cover = lowest sortOrder, which is exactly what the hotel dragged to the front.
  const cover = option.photos[0];

  const href = (plan: PublicPlanQuote) =>
    `/${slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&roomTypeId=${option.roomTypeId}&ratePlanId=${plan.ratePlanId}`;

  return (
    <article className="card-raised overflow-hidden">
      <div className="grid sm:grid-cols-[minmax(0,13.5rem)_1fr]">
        {cover ? (
          /*
            The photo FILLS its column.

            It used to hold a 4:3 shape, on the theory that cropping a landscape photo into a tall
            column would show a strip of wall rather than a room. In practice the empty surface under
            the photo read as a broken image, and the crop does not: a room photograph is mostly bed
            and window through the middle, which is exactly the band a centred cover crop keeps. The
            filled column is also what every engine a guest has already used looks like.
          */
          <div
            className="relative hidden min-h-[13rem] sm:block"
            style={{ borderRight: "1px solid hsl(var(--line))", backgroundColor: "hsl(var(--surface))" }}
          >
            {/* Not next/image: this is already our own resized WebP, so a second optimisation pass
                would burn CPU to produce the same bytes. */}
            <RoomPhoto
              src={mediaUrl(cover.thumbKey)}
              alt={cover.alt || `${option.name} at this hotel`}
            />
            {option.photos.length > 1 && (
              <span
                className="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: "hsl(var(--ink) / 0.62)", color: "#fff" }}
              >
                <Images size={11} aria-hidden />
                {option.photos.length}
              </span>
            )}
          </div>
        ) : (
          /* No photo is a normal state, not a failure: a hotel can go live before its photo shoot,
             and a designed panel reads as intentional where a grey box reads as broken. */
          <div
            className="relative hidden min-h-[11rem] items-center justify-center sm:flex"
            style={{
              background: "linear-gradient(150deg, hsl(var(--brand-wash)), hsl(var(--brand-soft) / 0.65))",
              borderRight: "1px solid hsl(var(--line))",
            }}
            aria-hidden
          >
            <BedDouble size={30} strokeWidth={1.4} style={{ color: "hsl(var(--brand-text) / 0.35)" }} />
          </div>
        )}

        <div className="min-w-0">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 pt-5">
            <div className="min-w-0">
              <h2 className="display text-[1.3rem] sm:text-[1.5rem]">{option.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="chip">
                  <Users size={13} aria-hidden />
                  Sleeps {option.maxGuests}
                </span>
                {rest.length > 0 && (
                  <span className="chip">
                    {plans.length} rates available
                  </span>
                )}
              </div>
            </div>

            {/* Honest scarcity only — a real count, and only when it is genuinely low. */}
            {option.remaining <= 3 && (
              <span
                className="rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{ backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}
              >
                {option.remaining === 1 ? "Last room" : `Only ${option.remaining} left`}
              </span>
            )}
          </header>

          <div className="mt-4">
            <RateRow plan={best} nights={nights} href={href(best)} highlight={rest.length > 0} />
          </div>

          {rest.length > 0 && (
            /* Native <details>: no JavaScript, works before hydration, and the browser gives us
               keyboard and screen-reader behaviour for free. */
            <details className="group border-t" style={{ borderColor: "hsl(var(--line))" }}>
              <summary
                className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-semibold transition-colors hover:bg-[hsl(var(--surface-sunk))] [&::-webkit-details-marker]:hidden"
                style={{ color: "hsl(var(--brand-text))" }}
              >
                <span>
                  {rest.length} other {rest.length === 1 ? "rate" : "rates"} — breakfast, flexible
                  cancellation
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className="transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              {rest.map((plan) => (
                <div key={plan.ratePlanId} className="border-t" style={{ borderColor: "hsl(var(--line))" }}>
                  <RateRow plan={plan} nights={nights} href={href(plan)} />
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

function RateRow({
  plan, nights, href, highlight = false,
}: {
  plan: PublicPlanQuote;
  nights: number;
  href: string;
  /** The cheapest rate, when there is something to be cheaper than. */
  highlight?: boolean;
}) {
  return (
    <div className="grid gap-4 px-5 pb-5 pt-1 sm:grid-cols-[1fr_auto] sm:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14.5px] font-bold">{plan.name}</h3>
          {highlight && (
            <span className="badge-brand">
              <Sparkles size={11} aria-hidden />
              Best price
            </span>
          )}
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          {plan.mealPlan && (
            <span className="flex items-center gap-1.5">
              <Coffee size={13} aria-hidden style={{ color: "hsl(var(--positive))" }} />
              {plan.mealPlan}
            </span>
          )}
          {plan.cancellationPolicy && (
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} aria-hidden style={{ color: "hsl(var(--positive))" }} />
              {plan.cancellationPolicy}
            </span>
          )}
        </div>

        {/* Always visible. A total you have to hunt for is only marginally better than one that
            surprises you at the end. */}
        <dl
          className="mt-3 inline-flex flex-wrap gap-x-5 gap-y-1 rounded-[var(--r-sm)] px-3 py-2 text-[12px]"
          style={{ backgroundColor: "hsl(var(--surface-sunk))", color: "hsl(var(--ink-soft))" }}
        >
          <div className="flex gap-1.5">
            <dt>
              Rooms, {nights} {nights === 1 ? "night" : "nights"}
            </dt>
            <dd className="nums font-semibold">{money(plan.accommodationMinor, plan.currency)}</dd>
          </div>
          {plan.charges.map((c) => (
            <div key={c.name} className="flex gap-1.5">
              <dt>{c.name}</dt>
              <dd className="nums font-semibold">{money(c.amountMinor, plan.currency)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <div className="text-left sm:text-right">
          <div className="price text-[1.6rem]">{money(plan.totalMinor, plan.currency)}</div>
          <div className="nums mt-1.5 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
            total · {money(plan.perNightMinor, plan.currency)} a night
          </div>
        </div>
        <a href={href} className="btn btn-brand shrink-0 sm:w-[9rem]">
          Select
        </a>
      </div>
    </div>
  );
}
