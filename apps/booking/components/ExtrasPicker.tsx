"use client";

import { extraTotalMinor, type SellableExtra } from "@revio/core";
import { Plus } from "lucide-react";
import { money } from "@/lib/dates";

/**
 * Extras the hotel sells, offered AFTER the room is chosen.
 *
 * Placement is the design decision here, not the styling. An upsell beside the price on the results
 * page would break the one promise this product makes — that the first number a guest sees is the
 * number they pay — by making the headline figure a starting price. Here the room is already
 * decided, the total is already honest, and adding something is a deliberate act with the new total
 * visible as it happens.
 *
 * Nothing is pre-ticked. A pre-selected extra is a dark pattern with a conversion metric attached,
 * and this page's whole argument is that it does not do those.
 */
export function ExtrasPicker({
  extras,
  nights,
  chosen,
  onToggle,
  currency,
}: {
  extras: SellableExtra[];
  nights: number;
  chosen: Set<string>;
  onToggle: (id: string) => void;
  /**
   * The currency code — NOT a formatter.
   *
   * A function cannot cross the server→client boundary: passing one typechecks and then throws at
   * render with "Functions cannot be passed directly to Client Components". A string crosses fine,
   * and formatting is a pure helper this side can import for itself.
   */
  currency: string;
}) {
  if (extras.length === 0) return null;

  return (
    <section className="card-raised p-5 sm:p-6">
      <h2 className="display text-[1.25rem]">Anything else?</h2>
      <p className="mt-1 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
        Optional — added to the same bill, and settled at the hotel with everything else.
      </p>

      <ul className="mt-4 space-y-2">
        {extras.map((e) => {
          const on = chosen.has(e.id);
          const total = extraTotalMinor(e, nights);
          return (
            <li key={e.id}>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-[var(--r-sm)] border p-3.5 transition-colors"
                style={{
                  borderColor: on ? "hsl(var(--brand))" : "hsl(var(--line-strong))",
                  backgroundColor: on ? "hsl(var(--brand-wash))" : "hsl(var(--surface))",
                }}
              >
                <input
                  type="checkbox"
                  name="extraIds"
                  value={e.id}
                  checked={on}
                  onChange={() => onToggle(e.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                  style={{ accentColor: "hsl(var(--brand))" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[14.5px] font-bold">{e.name}</span>
                    <span className="text-[14px] font-bold" style={{ color: "hsl(var(--brand-text))" }}>
                      {money(total, currency)}
                    </span>
                  </span>
                  {e.description && (
                    <span className="mt-0.5 block text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
                      {e.description}
                    </span>
                  )}
                  {/* Per-night extras show the arithmetic. "€36" on a 3-night stay is a number a
                      guest has to reverse-engineer; "€12 a night × 3 nights" is one they can check. */}
                  <span className="mt-0.5 block text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>
                    {e.basis === "per_night"
                      ? `${money(e.priceMinor, currency)} a night × ${nights} ${nights === 1 ? "night" : "nights"}`
                      : "once, for the whole stay"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {chosen.size === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
          <Plus size={13} aria-hidden /> Nothing selected — your total is unchanged.
        </p>
      )}
    </section>
  );
}
