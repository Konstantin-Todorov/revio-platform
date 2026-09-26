"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { applyBulkUpdateMulti, applyBulkUpdateBatch, type BulkPayload, type BulkRateMode, type BulkResult } from "@/lib/actions-calendar";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";
import { PlanTree } from "@revio/ui/plan-tree";
import { buildSelectionTree, roomsInSelection, selectAll, selectedPairs, selectionSummary } from "@revio/core";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { bulk as bulkDict } from "@/lib/i18n/bulk";

type Opt = { id: string; name: string; code: string };
type PlanOpt = {
  id: string; name: string; code?: string | null; priceLogic: string; parentName: string | null;
  active?: boolean;
  /** ⚠️ Which rooms this plan is actually linked to. The selector is room-scoped; a plan without
   *  this cannot be placed under a room, which is the whole shape of BUG-019 and BUG-022. */
  roomTypeIds: string[];
};

const DOW = ["1", "2", "3", "4", "5", "6", "0"] as const;
const RATE_MODES: BulkRateMode[] = ["set", "inc_pct", "dec_pct", "inc_amt", "dec_amt"];
const selCls = inputCls;

/**
 * The one shared bulk editor (spec §3.1/§3.2). Any subset of the ARI attributes can be set in a single
 * pass (≥1 required); "Preview & apply" opens a confirm-then-result modal (green/red, X/backdrop dismiss).
 * Used both on the Bulk screen and — via `compact` + `onApplied` — the Calendar bulk modal (§2.1).
 */
export function BulkUpdatePanel({
  roomTypes, ratePlans, today, preselectRoomTypeIds, compact, onApplied,
}: {
  roomTypes: Opt[];
  ratePlans: PlanOpt[];
  today: string;
  preselectRoomTypeIds?: string[];
  compact?: boolean;
  onApplied?: (r: BulkResult) => void;
}) {
  const b = translate(bulkDict, useLocale());
  const t = b.panel;
  const sm = b.summary;
  const in30 = useMemo(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), []);

  /*
   * ⚠️ ONE room-first tree, not two lists (§5, BUG-022).
   *
   * Two independent blocks could not show that a plan belongs to a room, and on 13 September both
   * plan checkboxes rendered a truncated list of room types instead of their own names — so the one
   * screen where you choose between two plans displayed them identically.
   *
   * A tree also expresses a selection two lists cannot: "1-Bedroom · BB Flex" AND "2-Bedroom · BB
   * Non-Refundable". Flattening that to rooms × plans produces FOUR pairs, applying the price to two
   * combinations nobody chose — which is why `pairs` goes to the writer and the two id lists are
   * derived from it, never the other way round.
   */
  const tree = useMemo(() => buildSelectionTree(roomTypes, ratePlans), [roomTypes, ratePlans]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    const all = selectAll(tree);
    if (!preselectRoomTypeIds) return all;
    // Opened from one calendar row: that room is the scope, with all of its plans.
    const scope = new Set(preselectRoomTypeIds);
    return new Set([...all].filter((k) => scope.has(k.split("|")[0]!)));
  });

  const pairs = useMemo(() => selectedPairs(tree, selected), [tree, selected]);
  // The legacy halves of the payload, derived — `roomTypeIds` drives allocation and restrictions
  // (written per room type), `ratePlanIds` only names the plans a price change may land on.
  const rtIds = useMemo(() => roomsInSelection(tree, selected), [tree, selected]);
  const planIds = useMemo(() => [...new Set(pairs.map((p) => p.ratePlanId))], [pairs]);
  const groups = useMemo(() => selectionSummary(tree, selected), [tree, selected]);

  // Scope
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(in30);
  const [dows, setDows] = useState<string[]>([]);

  // Attribute fields — "" / undefined means "no change" (untouched).
  const [rateMode, setRateMode] = useState<"" | BulkRateMode>("");
  const [rateValue, setRateValue] = useState("");
  const [minLos, setMinLos] = useState("");
  const [maxLos, setMaxLos] = useState("");
  const [cta, setCta] = useState<"" | "on" | "off">("");
  const [ctd, setCtd] = useState<"" | "on" | "off">("");
  const [stopSell, setStopSell] = useState<"" | "on" | "off">("");
  const [advMin, setAdvMin] = useState("");
  const [advMax, setAdvMax] = useState("");
  const [avail, setAvail] = useState("");

  /**
   * Changes queued to go out together.
   *
   * A hotel setting a weekend price, a holiday price and a minimum stay is making one decision, and
   * the channel should hear it once. Applying them one at a time is three API calls saying three
   * things that were always meant to arrive together — and the certification tests that name three
   * values on three dates allow exactly one call.
   */
  const [queue, setQueue] = useState<{ payload: BulkPayload; lines: string[]; scope: string }[]>([]);

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"closed" | "confirm" | "result">("closed");
  const [result, setResult] = useState<BulkResult | null>(null);
  // Frozen at apply time: the queue is cleared on success, so the result view cannot re-derive
  // what it just reported on.
  const [applied, setApplied] = useState<{ lines: string[]; scope: string }[]>([]);
  const [pending, startTransition] = useTransition();

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const num = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s));

  function buildPayload(): BulkPayload {
    const p: BulkPayload = { dateFrom, dateTo, daysOfWeek: dows.map(Number), roomTypeIds: rtIds, ratePlanIds: planIds, pairs };
    if (rateMode !== "" && rateValue.trim() !== "" && Number.isFinite(Number(rateValue))) p.rate = { mode: rateMode, value: Number(rateValue) };
    if (num(minLos) !== undefined) p.minLos = num(minLos)!;
    if (num(maxLos) !== undefined) p.maxLos = num(maxLos)!;
    if (cta !== "") p.cta = cta === "on";
    if (ctd !== "") p.ctd = ctd === "on";
    if (stopSell !== "") p.stopSell = stopSell === "on";
    if (num(advMin) !== undefined) p.advanceMin = num(advMin)!;
    if (num(advMax) !== undefined) p.advanceMax = num(advMax)!;
    if (num(avail) !== undefined) p.availability = num(avail)!;
    return p;
  }

  // Human-readable summary lines for the confirm + result views (one summary source).
  function summarize(p: BulkPayload): string[] {
    const lines: string[] = [];
    if (p.rate) {
      const label = t.rateModes[p.rate.mode] ?? p.rate.mode;
      // Named per room, because the same plan name can be selected on one room and not another.
      const names = groups.filter((g) => g.plans.length > 0)
        .map((g) => `${g.roomTypeName}: ${g.plans.map((pl) => pl.name).join(", ")}`)
        .join(" · ") || sm.standardPlan;
      lines.push(sm.price(label, String(p.rate.value), names));
    }
    const showNum = (v: number | null | undefined, days = false) => (v && v > 0 ? `${v}${days ? sm.days(v) : ""}` : sm.cleared);
    if (p.availability !== undefined) lines.push(sm.allocation(p.availability));
    if (p.minLos !== undefined) lines.push(sm.minStay(showNum(p.minLos)));
    if (p.maxLos !== undefined) lines.push(sm.maxStay(showNum(p.maxLos)));
    if (p.cta !== undefined) lines.push(sm.cta(p.cta));
    if (p.ctd !== undefined) lines.push(sm.ctd(p.ctd));
    if (p.stopSell !== undefined) lines.push(sm.stopSell(p.stopSell));
    if (p.advanceMin !== undefined) lines.push(sm.minAdvance(showNum(p.advanceMin, true)));
    if (p.advanceMax !== undefined) lines.push(sm.maxAdvance(showNum(p.advanceMax, true)));
    return lines;
  }

  const dowLabel = dows.length ? dows.map((d) => t.dow[d as keyof typeof t.dow]).join(", ") : t.everyDay;

  /** null when the form is a valid change, otherwise the reason it is not. */
  function validate(p: BulkPayload): string | null {
    if (rtIds.length === 0) return t.errors.noRoom;
    if (dateTo < dateFrom) return t.errors.dates;
    if (summarize(p).length === 0) return t.errors.nothing;
    return null;
  }

  function scopeLabel(): string {
    const rooms = rtIds.map((id) => roomTypes.find((r) => r.id === id)?.name).filter(Boolean).join(", ");
    const range = dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`;
    return `${rooms} · ${range}${dows.length ? ` · ${dowLabel}` : ""}`;
  }

  /** Park the current form as another change and clear the attribute fields, keeping the scope
   *  controls where they are — the next change is usually a near neighbour of this one. */
  function addToQueue() {
    setInlineError(null);
    const p = buildPayload();
    const err = validate(p);
    if (err) return setInlineError(err);
    setQueue((q) => [...q, { payload: p, lines: summarize(p), scope: scopeLabel() }]);
    setRateMode(""); setRateValue("");
    setMinLos(""); setMaxLos(""); setAdvMin(""); setAdvMax(""); setAvail("");
    setCta(""); setCtd(""); setStopSell("");
  }

  function openPreview() {
    setInlineError(null);
    const p = buildPayload();
    const err = validate(p);
    // With changes already queued the form may legitimately be empty — the queue IS the update.
    if (err && !(queue.length > 0 && err === t.errors.nothing)) return setInlineError(err);
    setResult(null);
    setPhase("confirm");
  }

  /** Everything that will be applied: the queue, plus the form if it still holds a change. */
  function pendingChanges(): { payload: BulkPayload; lines: string[]; scope: string }[] {
    const p = buildPayload();
    const lines = summarize(p);
    return lines.length > 0 && !validate(p) ? [...queue, { payload: p, lines, scope: scopeLabel() }] : queue;
  }

  function apply() {
    const changes = pendingChanges();
    setApplied(changes.map(({ lines, scope }) => ({ lines, scope })));
    startTransition(async () => {
      // One change still goes through the single-apply path: same result, and its audit entry keeps
      // naming the room types rather than a change count.
      const r = changes.length === 1
        ? await applyBulkUpdateMulti(changes[0]!.payload)
        : await applyBulkUpdateBatch(changes.map((c) => c.payload));
      setResult(r);
      setPhase("result");
      if (r.ok) { setQueue([]); onApplied?.(r); }
    });
  }

  const batch = phase !== "closed" ? pendingChanges() : [];
  const cols = compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2";

  return (
    <div className={compact ? "" : "rounded-lg border border-surface-border bg-white p-5 shadow-card"}>
      <div className={`grid gap-5 ${cols}`}>
        {/* Scope */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.from}><DateField value={dateFrom} min={today} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} /></Field>
            <Field label={t.to}><DateField value={dateTo} min={today} onChange={(e) => setDateTo(e.target.value)} className={inputCls} /></Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">{t.days}</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((v) => (
                <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${dows.includes(v) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-surface-border text-ink-600 hover:bg-surface-muted"}`}>
                  <input type="checkbox" checked={dows.includes(v)} onChange={() => setDows((a) => toggle(a, v))} className="sr-only" />
                  {t.dow[v]}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">{t.everyDayHint}</span>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">
              {t.whichPlans}
            </span>
            <PlanTree rooms={tree} selected={selected} onChange={setSelected} strings={b.tree} />
            <span className="mt-1.5 block text-[11px] leading-snug text-ink-400">
              {t.plansHint}
            </span>
          </div>
        </div>

        {/* Attributes — any subset (spec §3.1) */}
        <div className="space-y-3.5">
          <div className="rounded-md bg-surface-muted px-3 py-2 text-[11.5px] font-medium text-ink-500">
            {t.fillOnly}
          </div>
          <div className="grid grid-cols-[1fr,7rem] gap-2">
            <Field label={t.price}><select value={rateMode} onChange={(e) => setRateMode(e.target.value as BulkRateMode | "")} className={selCls}>
              <option value="">{t.noChange}</option>
              {RATE_MODES.map((m) => <option key={m} value={m}>{t.rateModes[m]}</option>)}
            </select></Field>
            <Field label={t.value}><input type="number" step="0.01" value={rateValue} onChange={(e) => setRateValue(e.target.value)} disabled={rateMode === ""} placeholder="—" className={`${inputCls} disabled:opacity-50`} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.allocation} hint={t.allocationHint}><input type="number" min="0" value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <div />
            <Field label={t.minStay}><input type="number" min="0" value={minLos} onChange={(e) => setMinLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label={t.maxStay}><input type="number" min="0" value={maxLos} onChange={(e) => setMaxLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label={t.minAdvance}><input type="number" min="0" value={advMin} onChange={(e) => setAdvMin(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label={t.maxAdvance}><input type="number" min="0" value={advMax} onChange={(e) => setAdvMax(e.target.value)} placeholder="—" className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t.cta}><select value={cta} onChange={(e) => setCta(e.target.value as "" | "on" | "off")} className={selCls}><option value="">{t.noChange}</option><option value="on">{t.closed}</option><option value="off">{t.open}</option></select></Field>
            <Field label={t.ctd}><select value={ctd} onChange={(e) => setCtd(e.target.value as "" | "on" | "off")} className={selCls}><option value="">{t.noChange}</option><option value="on">{t.closed}</option><option value="off">{t.open}</option></select></Field>
            <Field label={t.planStatus}><select value={stopSell} onChange={(e) => setStopSell(e.target.value as "" | "on" | "off")} className={selCls}><option value="">{t.noChange}</option><option value="off">{t.openSell}</option><option value="on">{t.closeStop}</option></select></Field>
          </div>
          <p className="text-[11px] text-ink-400">{t.clearHint("0")[0]}<span className="font-semibold">0</span>{t.clearHint("0")[1]}</p>
          {inlineError && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{inlineError}</p>}

          {queue.length > 0 && (
            <div className="rounded-md border border-brand-200 bg-brand-50/60 p-3">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                {t.queued(queue.length)}
              </span>
              <ul className="space-y-1.5">
                {queue.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded border border-brand-200/70 bg-white px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-medium text-ink-500">{c.scope}</div>
                      <div className="text-[12.5px] text-ink-700">{c.lines.join(" · ")}</div>
                    </div>
                    <button type="button" aria-label={t.removeChange(i + 1)} onClick={() => setQueue((q) => q.filter((_, j) => j !== i))} className="mt-0.5 shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-[auto,1fr] gap-2">
            <button type="button" onClick={addToQueue} title={t.addAnotherTitle} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3.5 py-2.5 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">
              <Plus className="h-4 w-4" /> {t.addAnother}
            </button>
            <button type="button" onClick={openPreview} className="rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              {t.preview}{queue.length > 0 ? ` (${queue.length + (summarize(buildPayload()).length > 0 ? 1 : 0)})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm → result modal (spec §3.2) */}
      <Modal open={phase !== "closed"} onClose={() => setPhase("closed")} title={phase === "result" ? t.resultTitle : t.reviewTitle}>
        {phase === "confirm" && batch.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-md border border-surface-border bg-surface-muted/60 px-3.5 py-3 text-[12.5px] text-ink-600">
              {batch.length === 1
                ? t.single
                : t.many(batch.length)}
            </div>
            {batch.map((c, ci) => (
              <div key={ci}>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {batch.length > 1 ? t.changeN(ci + 1) : t.changes}{c.scope}
                </span>
                <ul className="space-y-1.5">
                  {c.lines.map((l, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{l}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md border border-surface-border px-4 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">{t.cancel}</button>
              <button type="button" onClick={apply} disabled={pending} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? t.applying : t.apply}</button>
            </div>
          </div>
        )}
        {phase === "result" && result && (
          <div className="space-y-4">
            {result.ok ? (
              <div className="flex items-start gap-2.5 rounded-md bg-success-50 px-3.5 py-3 text-[13.5px] font-semibold text-success-600">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>{t.success}</div><div className="mt-0.5 text-[12px] font-medium text-success-600/90">{t.applied(result.affected ?? 0)}</div></div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md bg-danger-50 px-3.5 py-3 text-[13.5px] font-semibold text-danger-600">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>{t.failed}</div><div className="mt-0.5 text-[12px] font-medium text-danger-600/90">{result.error ?? t.failedFallback}</div></div>
              </div>
            )}
            {result.ok && (
              <ul className="space-y-1.5">
                {applied.flatMap((c) => c.lines).map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-500" />{l}</li>
                ))}
              </ul>
            )}
            {result.warning && (
              <p className="flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{result.warning}</p>
            )}
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700">{t.done}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
