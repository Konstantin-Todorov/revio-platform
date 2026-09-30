"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { DateRangePanel } from "./DateRangePanel";
import { nightsBetween } from "@/lib/dates";
import { useGuestKit } from "@/lib/i18n/use-kit";
import { termsWords } from "@/lib/i18n/kit";
import { changeMyBooking, previewMyChange, type PreviewResult } from "@/lib/actions-manage";

/**
 * Pick new dates → see the new price beside the old → confirm. The calendar is the same one the
 * search uses, prices included, so "which nights are cheaper" is answered on the spot. Nothing
 * moves until the guest presses the button under a number they have read.
 */
export function ChangeDates({
  slug, reference, manageKey, current, guests, currency,
}: {
  slug: string;
  reference: string;
  manageKey: string;
  current: { checkIn: string; checkOut: string; totalMinor: number };
  guests: number;
  currency: string;
}) {
  const kit = useGuestKit();
  const { s, fmtDay, money } = kit;
  const m = s.manage;
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  function preview(ci: string, co: string) {
    setNotice(null);
    startCheck(async () => setResult(await previewMyChange(slug, reference, manageKey, ci, co)));
  }

  function onSelect(ci: string | null, co: string | null) {
    setCheckIn(ci);
    setCheckOut(co);
    setResult(null);
    if (ci && co) preview(ci, co);
  }

  const range = (a: string, b: string) => `${fmtDay(a)} — ${fmtDay(b)}`;
  const ok = result?.ok ? result.preview : null;
  const diff = ok ? ok.totalMinor - current.totalMinor : 0;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[auto_minmax(17rem,1fr)] lg:items-start">
      <div className="card w-full overflow-hidden sm:w-fit">
        <DateRangePanel
          checkIn={checkIn}
          checkOut={checkOut}
          onSelect={onSelect}
          onDone={() => { if (checkIn && checkOut) preview(checkIn, checkOut); }}
          prices={{ slug, guests }}
        />
      </div>

      <div className="card-raised p-5" aria-live="polite">
        <p className="eyebrow">{m.current}</p>
        <p className="mt-1 text-[14.5px] font-semibold">{range(current.checkIn, current.checkOut)}</p>
        <p className="text-[13px]" style={{ color: "hsl(var(--ink-faint))" }}>
          {s.count.nights(nightsBetween(current.checkIn, current.checkOut))} · {money(current.totalMinor, currency)}
        </p>

        <div className="my-4 border-t" style={{ borderColor: "hsl(var(--line))" }} />

        <p className="eyebrow">{m.proposed}</p>
        {!checkIn || !checkOut ? (
          <p className="mt-1 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>{m.pickDates}</p>
        ) : checking ? (
          <p className="mt-1 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>{m.checking}</p>
        ) : ok ? (
          <>
            <p className="mt-1 flex items-center gap-2 text-[14.5px] font-semibold">
              <ArrowRight size={15} aria-hidden style={{ color: "hsl(var(--brand-text))" }} />
              {range(ok.checkIn, ok.checkOut)}
            </p>
            <p className="text-[13px]" style={{ color: "hsl(var(--ink-faint))" }}>{s.count.nights(nightsBetween(ok.checkIn, ok.checkOut))}</p>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[13.5px] font-semibold">{m.newTotal}</span>
              <span className="price text-[1.5rem]">{money(ok.totalMinor, currency)}</span>
            </div>
            <p className="text-right text-[12.5px] font-semibold"
               style={{ color: diff > 0 ? "hsl(var(--caution))" : diff < 0 ? "hsl(var(--positive))" : "hsl(var(--ink-faint))" }}>
              {diff === 0 ? m.sameTotal : m.difference(diff > 0 ? "+" : "−", money(Math.abs(diff), currency))}
            </p>
            {ok.terms && (
              <ul className="mt-3 space-y-0.5 border-t pt-3 text-[12.5px]" style={{ borderColor: "hsl(var(--line))", color: "hsl(var(--ink-soft))" }}>
                {termsWords(kit, ok.terms, currency).details.map((l) => <li key={l}>{l}</li>)}
              </ul>
            )}
            {notice && (
              <p className="mt-3 text-[13px] font-semibold" style={{ color: "hsl(var(--caution))" }} role="alert">{notice}</p>
            )}
            <form
              className="mt-4"
              action={(fd) => startSave(async () => {
                const res = await changeMyBooking(fd);
                // Success redirects; anything that comes back is a refusal to say.
                if (!res.ok) {
                  if (res.code === "price_changed") {
                    setResult(await previewMyChange(slug, reference, manageKey, ok.checkIn, ok.checkOut));
                  } else {
                    setResult(res);
                  }
                  setNotice(m.refusal[res.code]);
                }
              })}
            >
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="k" value={manageKey} />
              <input type="hidden" name="checkIn" value={ok.checkIn} />
              <input type="hidden" name="checkOut" value={ok.checkOut} />
              <input type="hidden" name="expectedTotalMinor" value={ok.totalMinor} />
              <button type="submit" disabled={saving} className="btn btn-brand w-full">
                {saving ? m.changing : m.confirmChange}
              </button>
            </form>
          </>
        ) : result && !result.ok ? (
          <p className="mt-1 text-[13.5px] font-semibold" style={{ color: "hsl(var(--caution))" }} role="alert">
            {m.refusal[result.code]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
