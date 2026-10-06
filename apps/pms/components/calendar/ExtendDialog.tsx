"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Link2 } from "lucide-react";
import { Dialog } from "@revio/ui/dialog";
import { fill } from "@revio/ui/i18n";
import type { TapeBar } from "@/lib/tape-chart";
import type { CalendarExtendStrings } from "@/lib/i18n/calendar";
import type { ExtensionOutcome, ExtensionQuote, ExtensionRefusal } from "@/lib/actions-extend";

/**
 * The price, before the nights are taken.
 *
 * A drag on the calendar only says how far; this says what it costs and lets reception change it.
 * Shaped like the line on a bill — nights, each night's price, the total, what goes on top — because
 * that is what the guest at the desk will be shown next. The stepper is the same control for a
 * keyboard and for somebody who opened it from the stay rather than by dragging.
 */

export interface ExtendDialogProps {
  bar: TapeBar | null;
  /** The departure the drag landed on, `YYYY-MM-DD`. */
  initialCheckOut: string | null;
  quoteAction: (assignmentId: string, newCheckOut: string) => Promise<ExtensionQuote | { ok: false; code: ExtensionRefusal }>;
  extendAction: (fd: FormData) => Promise<ExtensionOutcome>;
  onClose: () => void;
  onDone: (outcome: Extract<ExtensionOutcome, { ok: true }>) => void;
  money: (minor: number, currency: string) => string;
  formatDate: (ymd: string) => string;
  t: CalendarExtendStrings;
}

const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** "120", "120,50", "120.50" → minor units; anything else → null. */
function parseMajor(text: string): number | null {
  const clean = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
const toMajor = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

export function ExtendDialog({ bar, initialCheckOut, quoteAction, extendAction, onClose, onDone, money, formatDate, t }: ExtendDialogProps) {
  const open = bar != null && initialCheckOut != null;
  const retained = useRef<TapeBar | null>(null);
  if (bar) retained.current = bar;
  const stay = bar ?? retained.current;

  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut);
  const [quote, setQuote] = useState<ExtensionQuote | null>(null);
  const [refusal, setRefusal] = useState<ExtensionRefusal | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState("");
  const edited = useRef(false);

  useEffect(() => {
    setCheckOut(initialCheckOut);
    edited.current = false;
  }, [initialCheckOut, bar]);

  useEffect(() => {
    if (!open || !stay || !checkOut) return;
    let live = true;
    setLoading(true);
    setRefusal(null);
    quoteAction(stay.assignmentId, checkOut).then((q) => {
      if (!live) return;
      setLoading(false);
      if (!q.ok) { setQuote(null); setRefusal(q.code); return; }
      setQuote(q);
      // A typed price survives changing the number of nights only while it was never typed.
      if (!edited.current) setTotal(q.accommodationMinor != null ? toMajor(q.accommodationMinor) : "");
    });
    return () => { live = false; };
  }, [open, stay, checkOut, quoteAction]);

  if (!stay || !checkOut) return null;
  const extra = nightsBetween(stay.stayTo, checkOut);
  const totalMinor = parseMajor(total);
  const quotedMinor = quote?.accommodationMinor ?? null;
  const scale = quotedMinor && totalMinor != null && quotedMinor > 0 ? totalMinor / quotedMinor : 1;
  // A percentage moves with the price reception typed; a fixed fee (the tourist tax) does not.
  const fees = (quote?.fees ?? []).map((f) => (f.kind === "tax" ? { ...f, amountMinor: Math.round(f.amountMinor * scale) } : f));
  const feesMinor = fees.reduce((s, f) => s + f.amountMinor, 0);
  // With no rate to keep the shape of, a typed total reads as the same price every night.
  const evenMinor = quotedMinor == null && totalMinor != null && quote ? totalMinor / quote.nights.length : null;
  const count = (n: number) => fill(n === 1 ? t.nightOne : t.nightMany, { n });

  async function confirm() {
    if (!stay || !checkOut || totalMinor == null) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("assignmentId", stay.assignmentId);
    fd.set("checkOut", stay.stayTo);
    fd.set("newCheckOut", checkOut);
    fd.set("totalMinor", String(totalMinor));
    const outcome = await extendAction(fd);
    setSaving(false);
    if (!outcome.ok) { setRefusal(outcome.code); return; }
    onDone(outcome);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={fill(t.title, { name: stay.guestName })}
      description={fill(t.desc, { room: stay.unitLabel, date: formatDate(stay.stayTo) })}
      footer={
        <>
          <button type="button" onClick={onClose}
            className="rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 hover:bg-surface-muted">
            {t.cancel}
          </button>
          <button type="button" onClick={confirm} disabled={!quote || loading || saving || totalMinor == null}
            className="rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {fill(t.confirm, { date: formatDate(checkOut) })}
          </button>
        </>
      }
    >
      <div className="space-y-3 pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[12.5px] font-semibold text-ink-700">{t.nights}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label={t.fewer} disabled={extra <= 1 || saving}
              onClick={() => setCheckOut(addDays(checkOut, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-border text-ink-700 hover:bg-surface-muted disabled:opacity-40">
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[5.5rem] text-center text-[14px] font-bold text-ink-900" aria-live="polite">{count(extra)}</span>
            <button type="button" aria-label={t.more} disabled={extra >= 30 || saving}
              onClick={() => setCheckOut(addDays(checkOut, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-border text-ink-700 hover:bg-surface-muted disabled:opacity-40">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="-mt-1 text-[12px] text-ink-500">
          {t.newCheckOut}: <span className="font-semibold text-ink-900">{formatDate(checkOut)}</span>
        </div>

        {quote?.mode === "linked" && (
          <div className="flex gap-2 rounded-md bg-brand-50 px-2.5 py-2 text-[12px] text-brand-800">
            <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold">{t.linkedTitle}</div>
              <div className="mt-0.5">{t.linkedBody}</div>
            </div>
          </div>
        )}

        {loading && !quote && <p className="text-[12.5px] text-ink-500">{t.loading}</p>}

        {refusal && (
          <p role="alert" className="rounded-md bg-danger-50 px-2.5 py-2 text-[12.5px] text-danger-700">{t.refusals[refusal]}</p>
        )}

        {quote && (
          <div className={`space-y-2 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[11.5px] text-ink-500">
                <span>{t.perNight}</span>
                <span>{fill(t.ratePlan, { plan: quote.ratePlanName })}</span>
              </div>
              <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
                {quote.nights.map((n) => (
                  <li key={n.date} className="flex items-baseline justify-between px-2.5 py-1.5 text-[12.5px]">
                    <span className="text-ink-700">{formatDate(n.date)}</span>
                    <span className={`tnum font-semibold ${n.rateMinor == null && evenMinor == null ? "text-danger-600" : "text-ink-900"}`}>
                      {evenMinor != null
                        ? money(Math.round(evenMinor), quote.currency)
                        : n.rateMinor == null ? t.noRate : money(Math.round(n.rateMinor * scale), quote.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="block">
              <span className="text-[12px] font-semibold text-ink-700">{t.total}</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => { edited.current = true; setTotal(e.target.value); }}
                  className={`h-10 w-32 min-w-0 rounded-md border px-2.5 text-right text-[14px] font-bold tnum text-ink-900 ${
                    totalMinor == null ? "border-danger-500" : "border-surface-border"
                  }`}
                />
                <span className="text-[13px] text-ink-500">{quote.currency}</span>
              </div>
              <span className="mt-1 block text-[11.5px] text-ink-500">
                {quotedMinor == null ? t.totalNeeded : t.totalHint}
              </span>
            </label>

            {fees.length > 0 && (
              <div className="text-[12px] text-ink-600">
                <span className="text-ink-500">{t.fees}: </span>
                {fees.map((f) => `${f.name} ${money(f.amountMinor, quote.currency)}`).join(" · ")}
                {feesMinor > 0 && totalMinor != null && (
                  <span className="ml-1 font-semibold text-ink-900">= {money(totalMinor + feesMinor, quote.currency)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
