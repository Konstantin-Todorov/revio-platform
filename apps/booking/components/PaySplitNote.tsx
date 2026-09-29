"use client";

import { stayTerms, type StayTermsPolicy } from "@revio/core";
import { useExtrasTotal } from "@/lib/extras-store";
import { useGuestKit } from "@/lib/i18n/use-kit";

/**
 * The line under the total: how that total is paid. "Paid at the hotel" is only true of a rate
 * that takes nothing online; for a deposit or a prepaid rate it says what is taken now and what
 * later — from the same function the card step charges by, following the extras ticked.
 */
export function PaySplitNote({ policy, base, currency, paymentReady }: {
  policy: StayTermsPolicy | null;
  base: { totalMinor: number; firstNightMinor: number; arrival: string; today: string };
  currency: string;
  paymentReady: boolean;
}) {
  const extras = useExtrasTotal();
  const { s, money, fmtDay } = useGuestKit();
  const t = policy && paymentReady ? stayTerms(policy, { ...base, totalMinor: base.totalMinor + extras }) : null;
  const text = !t || t.payNowMinor === 0
    ? s.book.paidAtHotel
    : t.scheduled
      ? s.book.splitLater(money(t.payNowMinor, currency), money(t.scheduled.amountMinor, currency), fmtDay(t.scheduled.on))
      : t.atHotelMinor > 0
        ? s.book.splitHotel(money(t.payNowMinor, currency), money(t.atHotelMinor, currency))
        : s.book.paidNow;
  return <p className="mt-1.5 text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>{text}</p>;
}
