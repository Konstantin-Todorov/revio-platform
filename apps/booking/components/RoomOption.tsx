import type { PublicRoomOption } from "@revio/booking";
import { money } from "@/lib/availability";

/**
 * One room type and its rates.
 *
 * The headline number is the ALL-IN total for the whole stay. Per-night sits underneath in small
 * type, which is the opposite of how an OTA presents it — they lead with a per-night figure that
 * grows once taxes appear. Leading with the true total is the entire point, so it gets the emphasis.
 *
 * The breakdown is always visible rather than hidden behind a tooltip: a total you have to hunt for
 * is only marginally better than one that surprises you.
 */
export function RoomOption({
  option,
  nights,
  slug,
  checkIn,
  checkOut,
  guests,
}: {
  option: PublicRoomOption;
  nights: number;
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  // Cheapest first — the rate a guest is most likely to want, and the fairest comparison to an OTA.
  const plans = [...option.plans].sort((a, b) => a.totalMinor - b.totalMinor);

  return (
    <article className="card overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-5 py-4 rule">
        <div>
          <h2 className="display text-[1.45rem]">{option.name}</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
            Sleeps up to {option.maxGuests}
          </p>
        </div>
        {/* Honest scarcity only — a real count, and only when it is genuinely low. */}
        {option.remaining <= 3 && (
          <span className="text-[12.5px] font-semibold" style={{ color: "hsl(var(--caution))" }}>
            {option.remaining === 1 ? "Last room at this price" : `Only ${option.remaining} left`}
          </span>
        )}
      </div>

      <ul className="divide-y divide-[hsl(var(--rule))]">
        {plans.map((plan) => (
          <li key={plan.ratePlanId} className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 py-5">
            <div className="min-w-[15rem] flex-1">
              <h3 className="text-[14.5px] font-semibold">{plan.name}</h3>
              <p className="mt-1 flex flex-wrap gap-x-3 text-[12.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
                {plan.mealPlan && <span>{plan.mealPlan}</span>}
                {plan.cancellationPolicy && <span>{plan.cancellationPolicy}</span>}
              </p>

              <dl className="mt-3 space-y-0.5 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                <div className="flex gap-2">
                  <dt>
                    Rooms · {nights} {nights === 1 ? "night" : "nights"}
                  </dt>
                  <dd className="tabular-nums">{money(plan.accommodationMinor, plan.currency)}</dd>
                </div>
                {plan.charges.map((c) => (
                  <div key={c.name} className="flex gap-2">
                    <dt>{c.name}</dt>
                    <dd className="tabular-nums">{money(c.amountMinor, plan.currency)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex items-end gap-5">
              <div className="text-right">
                <div className="display text-[1.75rem] tabular-nums leading-none">
                  {money(plan.totalMinor, plan.currency)}
                </div>
                <div className="mt-1.5 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
                  total · {money(plan.perNightMinor, plan.currency)} a night
                </div>
              </div>
              <a
                href={`/${slug}/book?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&roomTypeId=${option.roomTypeId}&ratePlanId=${plan.ratePlanId}`}
                className="btn-brand shrink-0 rounded-lg px-6 py-3 text-[13.5px] font-semibold"
              >
                Select
              </a>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
