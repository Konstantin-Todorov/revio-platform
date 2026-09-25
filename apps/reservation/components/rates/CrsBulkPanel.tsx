"use client";

import { formatDay, translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { bulk as bulkDict } from "@/lib/i18n/bulk";
import { moneyIn } from "@/lib/i18n/money";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { applyCrsBulkUpdateMulti, type CrsBulkPayload, type CrsBulkRateMode, type CrsBulkResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";
import {
  matrixRows, expandOffsets, buildSelectionTree, roomsInSelection, selectAll, selectedPairs,
  selectionSummary, type BulkTargetRoom,
} from "@revio/core";
import { PlanTree } from "@revio/ui/plan-tree";
import { OccupancyMatrix, type MatrixEntry } from "./OccupancyMatrix";

type Opt = { id: string; name: string; code?: string | null; maxGuests?: number };
type PlanOpt = {
  id: string; name: string; code?: string | null; priceLogic: string; parentName: string | null;
  active?: boolean;
  /** ⚠️ Which rooms the plan is linked to — the selector is room-first (§5, BUG-022). */
  roomTypeIds: string[];
};

const DOW = ["1", "2", "3", "4", "5", "6", "0"] as const;
// "on the selected plans" matters in the "set" label: with derived plans in play, "set exact" reads
// as though it flattens every plan to one figure. It sets the plans you ticked; the derived ones
// recompute off them and keep their own offsets.
const RATE_MODES: CrsBulkRateMode[] = ["set", "inc_pct", "dec_pct", "inc_amt", "dec_amt"];

/**
 * The CRS bulk editor (CRS-REFINEMENT-R2 §7) — the twin of RevioLink's BulkUpdatePanel: any subset of
 * the ARI attributes in one pass (≥1 required) + a preview→apply→result modal (green/red, X/backdrop).
 * `compact` + `onApplied` drive the Inventory Calendar bulk modal (H2).
 */
export function CrsBulkPanel({
  roomTypes, ratePlans, today, preselectRoomTypeIds, perPerson = false, primaryOccupancy = 2, primaryOccupancyNote, compact, onApplied,
}: {
  roomTypes: Opt[];
  ratePlans: PlanOpt[];
  today: string;
  preselectRoomTypeIds?: string[];
  /** True when the property (or the selected plans) price per person — OBP §6.4. */
  perPerson?: boolean;
  primaryOccupancy?: number;
  primaryOccupancyNote?: string | null;
  compact?: boolean;
  onApplied?: (r: CrsBulkResult) => void;
}) {
  const locale = useLocale();
  const b = translate(bulkDict, locale);
  const P = b.panel;
  const S = b.summary;
  const money = moneyIn(locale);
  // The occupancy matrix replaces the single Price control when plans sell per person.
  const [matrixMode, setMatrixMode] = useState<"offsets" | "manual">("offsets");
  const [entries, setEntries] = useState<Record<number, MatrixEntry>>({});
  const [offset, setOffset] = useState<{ direction: "inc_amt" | "inc_pct"; value: string }>({ direction: "inc_amt", value: "" });
  const [primaryValue, setPrimaryValue] = useState("");

  const in30 = useMemo(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), []);
  const derivedPlans = ratePlans.filter((p) => p.priceLogic !== "manual");

  /*
   * ⚠️ ONE room-first tree — the SAME component RevioLink's bulk panel uses (§5.4).
   *
   * The two screens are the same operation with the same trap: two independent lists can only
   * describe a rectangle, so picking different plans on different rooms and flattening to
   * rooms × plans writes the price to combinations nobody chose. `pairs` is the authoritative form;
   * the id lists below are derived from it.
   */
  const tree = useMemo(() => buildSelectionTree(roomTypes, ratePlans), [roomTypes, ratePlans]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    const all = selectAll(tree);
    if (!preselectRoomTypeIds) return all;
    const scope = new Set(preselectRoomTypeIds);
    return new Set([...all].filter((k) => scope.has(k.split("|")[0]!)));
  });
  const pairs = useMemo(() => selectedPairs(tree, selected), [tree, selected]);
  // Restrictions and allocation are written per ROOM TYPE in CRS too, so this list is not the same
  // thing as "rooms that have a plan ticked" — see ROOM_ONLY in @revio/core.
  const rtIds = useMemo(() => roomsInSelection(tree, selected), [tree, selected]);
  const planIds = useMemo(() => [...new Set(pairs.map((p) => p.ratePlanId))], [pairs]);
  const groups = useMemo(() => selectionSummary(tree, selected), [tree, selected]);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(in30);
  const [dows, setDows] = useState<string[]>([]);

  const [rateMode, setRateMode] = useState<"" | CrsBulkRateMode>("");
  const [rateValue, setRateValue] = useState("");
  const [minLos, setMinLos] = useState("");
  const [maxLos, setMaxLos] = useState("");
  const [cta, setCta] = useState<"" | "on" | "off">("");
  const [ctd, setCtd] = useState<"" | "on" | "off">("");
  const [stopSell, setStopSell] = useState<"" | "on" | "off">("");
  const [advMin, setAdvMin] = useState("");
  const [advMax, setAdvMax] = useState("");
  const [avail, setAvail] = useState("");

  /*
   * §5.3 — three tabs instead of one scroll.
   *
   * A price change had to wade past rooms-to-sell, min/max stay, min/max advance and CTA/CTD to
   * reach the field it wanted. Rates is first and default because it is the reason the modal is
   * opened; the other two are there when they are needed and out of the way when they are not.
   */
  const [tab, setTab] = useState<"rates" | "availability" | "restrictions">("rates");
  /** € or %, from the operation — so the Value field can say which it wants. */
  const rateUnit = rateMode === "inc_pct" || rateMode === "dec_pct" ? "%" : "€";
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"closed" | "confirm" | "result">("closed");
  const [result, setResult] = useState<CrsBulkResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const num = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s));

  function buildPayload(): CrsBulkPayload {
    const p: CrsBulkPayload = { dateFrom, dateTo, daysOfWeek: dows.map(Number), roomTypeIds: rtIds, ratePlanIds: planIds, pairs };
    if (perPerson) {
      /*
       * One shape or the other, never both — the action would otherwise be choosing which the user
       * meant, and a scalar and a matrix produce different prices.
       */
      const occ = buildOccupancyEdits();
      if (occ.length > 0) p.occupancyRates = occ;
    } else if (rateMode !== "" && rateValue.trim() !== "" && Number.isFinite(Number(rateValue))) {
      p.rate = { mode: rateMode, value: Number(rateValue) };
    }
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

  /** The matrix, in whichever mode is active, as explicit per-occupancy edits. */
  function buildOccupancyEdits(): { occupancy: number; mode: CrsBulkRateMode; value: number }[] {
    const rooms = selectedRooms();
    const rows = matrixRows(rooms);
    if (rows.length === 0) return [];

    if (matrixMode === "offsets") {
      const base = Number(primaryValue);
      if (!primaryValue.trim() || !Number.isFinite(base)) return [];
      const step = Number(offset.value);
      const rule = offset.value.trim() && Number.isFinite(step)
        ? { perGuestAbove: { op: offset.direction, value: step } }
        : {};
      return expandOffsets(rows.map((r: { occupancy: number }) => r.occupancy), primaryOccupancy, base, rule)
        .map((e) => ({ occupancy: e.occupancy, mode: "set" as CrsBulkRateMode, value: e.value }));
    }

    return rows
      .map((r) => ({ occupancy: r.occupancy, entry: entries[r.occupancy] }))
      .filter((x): x is { occupancy: number; entry: MatrixEntry } =>
        !!x.entry && x.entry.op !== "" && x.entry.value.trim() !== "" && Number.isFinite(Number(x.entry.value)))
      .map((x) => ({ occupancy: x.occupancy, mode: x.entry.op as CrsBulkRateMode, value: Number(x.entry.value) }));
  }

  function selectedRooms(): BulkTargetRoom[] {
    return rtIds
      .map((id) => roomTypes.find((r) => r.id === id))
      .filter((r): r is Opt => !!r)
      .map((r) => ({ roomTypeId: r.id, roomName: r.name, maxOccupancy: r.maxGuests ?? 2 }));
  }

  /** "Studio: BB Flex · Suite: BB NR" — per room, because the same plan can be on one and not another. */
  function planNames(): string {
    return groups.filter((g) => g.plans.length > 0)
      .map((g) => `${g.roomTypeName}: ${g.plans.map((pl) => pl.name).join(", ")}`)
      .join(" · ");
  }

  function summarize(p: CrsBulkPayload): string[] {
    const lines: string[] = [];
    const showNum = (v: number | null | undefined) => (v && v > 0 ? String(v) : S.cleared);
    const showDays = (v: number | null | undefined) => (v && v > 0 ? S.days(v) : S.cleared);
    if (p.rate) {
      const label = P.rateModes[p.rate.mode] ?? p.rate.mode;
      const names = planNames() || S.standardPlan;
      const unit = p.rate.mode === "inc_pct" || p.rate.mode === "dec_pct" ? "%" : "€";
      lines.push(S.price(label, S.amount(p.rate.value, unit), names));
      /*
       * §5.3 — the blast radius, stated before the commit.
       *
       * The derived plans recompute off whatever you just changed, and the preview never said so.
       * A user could see "Price — increase by 10%" and have no idea five other plans were about to
       * move with it. Naming them is the difference between a bulk edit that feels safe and one
       * that feels like a gamble.
       */
      if (derivedPlans.length > 0) {
        const following = derivedPlans.map((d) => d.name).join(", ");
        lines.push(S.derived(derivedPlans.length, following));
      }
    }
    if (p.occupancyRates?.length) {
      const names = planNames() || S.everyManualPlan;
      lines.push(
        S.perGuest(p.occupancyRates.map((o) => S.guestPrice(o.occupancy, money(Math.round(o.value * 100)))).join(" · "), names),
      );
      // Named here as well as in the result: a skip discovered afterwards is a surprise.
      const short = selectedRooms().filter((r) => r.maxOccupancy < Math.max(...p.occupancyRates!.map((o) => o.occupancy)));
      if (short.length > 0) {
        lines.push(S.skipped(short.map((r) => `${r.roomName} (${r.maxOccupancy})`).join(", ")));
      }
    }
    if (p.availability !== undefined) lines.push(S.allocation(p.availability));
    if (p.minLos !== undefined) lines.push(S.minStay(showNum(p.minLos)));
    if (p.maxLos !== undefined) lines.push(S.maxStay(showNum(p.maxLos)));
    if (p.cta !== undefined) lines.push(S.cta(p.cta));
    if (p.ctd !== undefined) lines.push(S.ctd(p.ctd));
    if (p.stopSell !== undefined) lines.push(S.stopSell(p.stopSell));
    if (p.advanceMin !== undefined) lines.push(S.minAdvance(showDays(p.advanceMin)));
    if (p.advanceMax !== undefined) lines.push(S.maxAdvance(showDays(p.advanceMax)));
    return lines;
  }

  const payload = phase !== "closed" ? buildPayload() : null;
  const summaryLines = payload ? summarize(payload) : [];
  const rtNames = rtIds.map((id) => roomTypes.find((r) => r.id === id)?.name).filter(Boolean);
  const dowLabel = dows.length ? DOW.filter((d) => dows.includes(d)).map((d) => P.dow[d]).join(", ") : P.everyDay;

  function openPreview() {
    setInlineError(null);
    if (rtIds.length === 0) return setInlineError(P.errors.noRoom);
    if (dateTo < dateFrom) return setInlineError(P.errors.dates);
    if (summarize(buildPayload()).length === 0) return setInlineError(P.errors.nothing);
    setResult(null);
    setPhase("confirm");
  }

  function apply() {
    const p = buildPayload();
    startTransition(async () => {
      const r = await applyCrsBulkUpdateMulti(p);
      setResult(r);
      setPhase("result");
      if (r.ok) onApplied?.(r);
    });
  }

  const cols = compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2";

  return (
    <div className={compact ? "" : "p-4"}>
      <div className={`grid gap-5 ${cols}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={P.from}><DateField value={dateFrom} min={today} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} /></Field>
            <Field label={P.to}><DateField value={dateTo} min={today} onChange={(e) => setDateTo(e.target.value)} className={inputCls} /></Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">{P.days}</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((v) => (
                <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${dows.includes(v) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-surface-border text-ink-600 hover:bg-surface-muted"}`}>
                  <input type="checkbox" checked={dows.includes(v)} onChange={() => setDows((a) => toggle(a, v))} className="sr-only" />
                  {P.dow[v]}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">{P.everyDayHint}</span>
          </div>
          {/*
            §5.3 wanted the plans beside Price rather than a scroll away from it, and the tree keeps
            that: in a two-column panel the scope sits opposite the value fields, so "change THESE
            plans BY this much" is one glance, and it is now also one control instead of two lists
            that could not say which plan belonged to which room.
          */}
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">
              {P.whichPlans}
            </span>
            <PlanTree rooms={tree} selected={selected} onChange={setSelected} strings={b.tree} />
            <span className="mt-1.5 block text-[11px] leading-snug text-ink-400">
              {P.plansHint}
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-md bg-surface-muted px-3 py-2 text-[11.5px] font-medium text-ink-500">
            {P.fillOnly}
          </div>

          {/* Each tab shows a dot when it carries a pending change, so switching away from a tab
              cannot hide an edit that is about to be applied. */}
          <div className="flex gap-1 rounded-md bg-surface-sunken p-1">
            {([
              ["rates", P.tabs.rates, rateMode !== ""],
              ["availability", P.tabs.availability, avail !== ""],
              ["restrictions", P.tabs.restrictions, [minLos, maxLos, advMin, advMax, cta, ctd, stopSell].some((v) => v !== "")],
            ] as const).map(([key, label, dirty]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  tab === key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {label}
                {dirty && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>

          {tab === "rates" && (
            <div className="space-y-3">
              {/*
                §5.3 — the #1 easy win, and it is one sentence.
                The derived rows are greyed in the tree with the parent they follow, which says "you
                cannot edit these" and nothing about what happens when you change the parent. So the
                user does not know whether Non-Refundable follows or goes stale, and that doubt is
                the entire friction with the feature. The model is strong; it was simply invisible.
              */}
              {derivedPlans.length > 0 && (
                <span className="flex items-start gap-1.5 rounded-md bg-brand-50 px-2.5 py-1.5 text-[11.5px] font-medium leading-snug text-brand-800">
                  <span aria-hidden>📎</span>
                  <span>
                    {P.derivedNote}
                  </span>
                </span>
              )}

              {/*
                Under per-person the single Price control cannot express the edit: there is one price
                per guest count, not one price. The matrix replaces it rather than sitting beside it,
                because two controls for the same thing is how a scalar and a matrix both get sent.
              */}
              {perPerson ? (
                <OccupancyMatrix
                  rooms={selectedRooms()}
                  primaryOccupancy={primaryOccupancy}
                  primaryOccupancyNote={primaryOccupancyNote}
                  mode={matrixMode}
                  onModeChange={setMatrixMode}
                  entries={entries}
                  onEntryChange={(occ, e) => setEntries((prev) => ({ ...prev, [occ]: e }))}
                  offset={offset}
                  onOffsetChange={setOffset}
                  primaryValue={primaryValue}
                  onPrimaryValueChange={setPrimaryValue}
                />
              ) : (
              <div className="grid grid-cols-[1fr,8rem] gap-2">
                <Field label={P.price}><select value={rateMode} onChange={(e) => setRateMode(e.target.value as CrsBulkRateMode | "")} className={inputCls}>
                  <option value="">{P.noChange}</option>
                  {RATE_MODES.map((m) => <option key={m} value={m}>{P.rateModes[m]}</option>)}
                </select></Field>
                {/* §5.3 — the field echoes its own unit. "12" means something different under
                    "Increase by %" and "Increase by amount", and the input gave no clue which. */}
                <Field label={rateMode === "" ? P.value : P.valueIn(rateUnit)}>
                  <div className="relative">
                    <input
                      type="number" step="0.01" value={rateValue}
                      onChange={(e) => setRateValue(e.target.value)}
                      disabled={rateMode === ""} placeholder="—"
                      className={`${inputCls} ${rateMode === "" ? "" : "pr-6"} disabled:opacity-50`}
                    />
                    {rateMode !== "" && (
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-400">
                        {rateUnit}
                      </span>
                    )}
                  </div>
                </Field>
              </div>
              )}
            </div>
          )}

          {tab === "availability" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={P.allocation} hint={P.allocationHint}><input type="number" min="0" value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="—" className={inputCls} /></Field>
              <div />
              <p className="col-span-2 text-[11px] text-ink-400">
                {P.allocationNote}
              </p>
            </div>
          )}

          {tab === "restrictions" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label={P.minStay}><input type="number" min="0" value={minLos} onChange={(e) => setMinLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
                <Field label={P.maxStay}><input type="number" min="0" value={maxLos} onChange={(e) => setMaxLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
                <Field label={P.minAdvance}><input type="number" min="0" value={advMin} onChange={(e) => setAdvMin(e.target.value)} placeholder="—" className={inputCls} /></Field>
                <Field label={P.maxAdvance}><input type="number" min="0" value={advMax} onChange={(e) => setAdvMax(e.target.value)} placeholder="—" className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label={P.cta}><select value={cta} onChange={(e) => setCta(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">{P.noChange}</option><option value="on">{P.closed}</option><option value="off">{P.open}</option></select></Field>
                <Field label={P.ctd}><select value={ctd} onChange={(e) => setCtd(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">{P.noChange}</option><option value="on">{P.closed}</option><option value="off">{P.open}</option></select></Field>
                <Field label={P.planStatus}><select value={stopSell} onChange={(e) => setStopSell(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">{P.noChange}</option><option value="off">{P.openSell}</option><option value="on">{P.closeStop}</option></select></Field>
              </div>
              <p className="text-[11px] text-ink-400">{P.clearHint}</p>
            </div>
          )}

          {inlineError && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{inlineError}</p>}
          <button type="button" onClick={openPreview} className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            {P.preview}
          </button>
        </div>
      </div>

      <Modal open={phase !== "closed"} onClose={() => setPhase("closed")} title={phase === "result" ? P.resultTitle : P.reviewTitle}>
        {phase === "confirm" && payload && (
          <div className="space-y-4">
            <div className="rounded-md border border-surface-border bg-surface-muted/60 px-3.5 py-3 text-[12.5px] text-ink-600">
              <div><span className="font-semibold text-ink-800">{P.roomTypes}</span> {rtNames.join(", ")}</div>
              <div className="mt-0.5"><span className="font-semibold text-ink-800">{P.dates}</span> {formatDay(dateFrom, locale)} → {formatDay(dateTo, locale)} · {dowLabel}</div>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{P.changes}</span>
              <ul className="space-y-1.5">
                {summaryLines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{l}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md border border-surface-border px-4 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">{P.cancel}</button>
              <button type="button" onClick={apply} disabled={pending} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? P.applying : P.apply}</button>
            </div>
          </div>
        )}
        {phase === "result" && result && (
          <div className="space-y-4">
            {result.ok ? (
              <div className="flex items-start gap-2.5 rounded-md bg-success-50 px-3.5 py-3 text-[13.5px] font-semibold text-success-600">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>{P.success}</div><div className="mt-0.5 text-[12px] font-medium text-success-600/90">{P.applied(result.affected ?? 0)}</div></div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md bg-danger-50 px-3.5 py-3 text-[13.5px] font-semibold text-danger-600">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>{P.failed}</div><div className="mt-0.5 text-[12px] font-medium text-danger-600/90">{result.error ?? P.failedFallback}</div></div>
              </div>
            )}
            {result.ok && (
              <ul className="space-y-1.5">
                {summaryLines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-500" />{l}</li>
                ))}
              </ul>
            )}
            {result.warning && (
              <p className="flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{result.warning}</p>
            )}
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700">{P.done}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
