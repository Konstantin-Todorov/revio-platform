"use client";

import { useExtrasTotal } from "@/lib/extras-store";
import { money } from "@/lib/dates";

/**
 * The summary's total, which has to move when the guest adds an extra.
 *
 * There is exactly one total on this page and it is always the true one. Showing a room-only figure
 * beside a picker that changes the price would be the "starting price" pattern this product exists
 * to avoid — worse here than on an OTA, because the whole argument for booking direct is that the
 * number does not move on you.
 *
 * The extras line only appears once something is chosen; an "Extras €0" row on every booking is
 * noise pretending to be information.
 */
export function LiveTotal({
  baseTotalMinor,
  currency,
}: {
  /** Room + taxes + fees, computed on the server. Never recomputed here. */
  baseTotalMinor: number;
  /** The code, not a formatter — a function cannot cross into a client component. */
  currency: string;
}) {
  const extras = useExtrasTotal();

  return (
    <>
      {extras > 0 && (
        <div className="flex items-baseline justify-between text-[13px]">
          <span style={{ color: "hsl(var(--ink-soft))" }}>Extras</span>
          <span className="nums font-semibold">{money(extras, currency)}</span>
        </div>
      )}
      <div
        className="mt-3 flex items-baseline justify-between border-t pt-3"
        style={{ borderColor: "hsl(var(--line))" }}
      >
        <span className="text-[13px] font-semibold">Total</span>
        <span className="price text-[1.4rem]">{money(baseTotalMinor + extras, currency)}</span>
      </div>
    </>
  );
}
