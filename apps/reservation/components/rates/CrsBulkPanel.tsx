"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { applyCrsBulkUpdateMulti, type CrsBulkPayload, type CrsBulkRateMode, type CrsBulkResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type Opt = { id: string; name: string };
type PlanOpt = { id: string; name: string; priceLogic: string; parentName: string | null };

const DOW: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];
const RATE_MODES: [CrsBulkRateMode, string][] = [
  ["set", "Set exact price (€)"], ["inc_pct", "Increase by %"], ["dec_pct", "Decrease by %"],
  ["inc_amt", "Increase by amount (€)"], ["dec_amt", "Decrease by amount (€)"],
];

/**
 * The CRS bulk editor (CRS-REFINEMENT-R2 §7) — the twin of RevioLink's BulkUpdatePanel: any subset of
 * the ARI attributes in one pass (≥1 required) + a preview→apply→result modal (green/red, X/backdrop).
 * `compact` + `onApplied` drive the Inventory Calendar bulk modal (H2).
 */
export function CrsBulkPanel({
  roomTypes, ratePlans, today, preselectRoomTypeIds, compact, onApplied,
}: {
  roomTypes: Opt[];
  ratePlans: PlanOpt[];
  today: string;
  preselectRoomTypeIds?: string[];
  compact?: boolean;
  onApplied?: (r: CrsBulkResult) => void;
}) {
  const in30 = useMemo(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), []);
  const manualPlans = ratePlans.filter((p) => p.priceLogic === "manual");
  const derivedPlans = ratePlans.filter((p) => p.priceLogic !== "manual");

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(in30);
  const [dows, setDows] = useState<string[]>([]);
  const [rtIds, setRtIds] = useState<string[]>(preselectRoomTypeIds ?? roomTypes.map((r) => r.id));
  const [planIds, setPlanIds] = useState<string[]>(manualPlans.map((p) => p.id));

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

  const [inlineError, setInlineError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"closed" | "confirm" | "result">("closed");
  const [result, setResult] = useState<CrsBulkResult | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const num = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s));

  function buildPayload(): CrsBulkPayload {
    const p: CrsBulkPayload = { dateFrom, dateTo, daysOfWeek: dows.map(Number), roomTypeIds: rtIds, ratePlanIds: planIds };
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

  function summarize(p: CrsBulkPayload): string[] {
    const lines: string[] = [];
    const showNum = (v: number | null | undefined, unit = "") => (v && v > 0 ? `${v}${unit}` : "cleared");
    if (p.rate) {
      const label = RATE_MODES.find(([m]) => m === p.rate!.mode)?.[1] ?? p.rate.mode;
      const names = planIds.map((id) => manualPlans.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || "standard plan";
      lines.push(`Price — ${label}: ${p.rate.value} · on ${names}`);
    }
    if (p.availability !== undefined) lines.push(`Rooms to sell → ${p.availability}`);
    if (p.minLos !== undefined) lines.push(`Min stay → ${showNum(p.minLos)}`);
    if (p.maxLos !== undefined) lines.push(`Max stay → ${showNum(p.maxLos)}`);
    if (p.cta !== undefined) lines.push(`Closed to arrival → ${p.cta ? "on" : "off"}`);
    if (p.ctd !== undefined) lines.push(`Closed to departure → ${p.ctd ? "on" : "off"}`);
    if (p.stopSell !== undefined) lines.push(`Stop-sell → ${p.stopSell ? "closed" : "open"}`);
    if (p.advanceMin !== undefined) lines.push(`Min advance → ${showNum(p.advanceMin, " days")}`);
    if (p.advanceMax !== undefined) lines.push(`Max advance → ${showNum(p.advanceMax, " days")}`);
    return lines;
  }

  const payload = phase !== "closed" ? buildPayload() : null;
  const summaryLines = payload ? summarize(payload) : [];
  const rtNames = rtIds.map((id) => roomTypes.find((r) => r.id === id)?.name).filter(Boolean);
  const dowLabel = dows.length ? dows.map((d) => DOW.find(([v]) => v === d)?.[1]).join(", ") : "every day";

  function openPreview() {
    setInlineError(null);
    if (rtIds.length === 0) return setInlineError("Select at least one room type.");
    if (dateTo < dateFrom) return setInlineError("End date is before start date.");
    if (summarize(buildPayload()).length === 0) return setInlineError("Set at least one field to update.");
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
            <Field label="From"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} /></Field>
            <Field label="To"><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} /></Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Days of week</span>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map(([v, label]) => (
                <label key={v} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${dows.includes(v) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-surface-border text-ink-600 hover:bg-surface-muted"}`}>
                  <input type="checkbox" checked={dows.includes(v)} onChange={() => setDows((a) => toggle(a, v))} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">Leave all off to apply to every day.</span>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Room types</span>
            <div className="grid grid-cols-2 gap-1.5">
              {roomTypes.map((rt) => (
                <label key={rt.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" checked={rtIds.includes(rt.id)} onChange={() => setRtIds((a) => toggle(a, rt.id))} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {rt.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Rate plans <span className="font-normal text-ink-400">(for the price change — manual only)</span></span>
            <div className="grid grid-cols-2 gap-1.5">
              {manualPlans.map((rp) => (
                <label key={rp.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" checked={planIds.includes(rp.id)} onChange={() => setPlanIds((a) => toggle(a, rp.id))} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {rp.name}
                </label>
              ))}
              {derivedPlans.map((rp) => (
                <span key={rp.id} title={`Derived from ${rp.parentName ?? "its parent"} — its price follows the parent automatically`} className="flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-surface-border px-2.5 py-1.5 text-[12.5px] text-ink-300">
                  📎 {rp.name} <span className="text-[10px] uppercase">derived</span>
                </span>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">Restrictions apply per room type regardless of rate plan.</span>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-md bg-surface-muted px-3 py-2 text-[11.5px] font-medium text-ink-500">
            Fill only the fields you want to change — the rest stay as they are. At least one is required.
          </div>
          <div className="grid grid-cols-[1fr,7rem] gap-2">
            <Field label="Price"><select value={rateMode} onChange={(e) => setRateMode(e.target.value as CrsBulkRateMode | "")} className={inputCls}>
              <option value="">— No change —</option>
              {RATE_MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
            </select></Field>
            <Field label="Value"><input type="number" step="0.01" value={rateValue} onChange={(e) => setRateValue(e.target.value)} disabled={rateMode === ""} placeholder="—" className={`${inputCls} disabled:opacity-50`} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rooms to sell"><input type="number" min="0" value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <div />
            <Field label="Min stay (nights)"><input type="number" min="0" value={minLos} onChange={(e) => setMinLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label="Max stay (nights)"><input type="number" min="0" value={maxLos} onChange={(e) => setMaxLos(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label="Min advance (days)"><input type="number" min="0" value={advMin} onChange={(e) => setAdvMin(e.target.value)} placeholder="—" className={inputCls} /></Field>
            <Field label="Max advance (days)"><input type="number" min="0" value={advMax} onChange={(e) => setAdvMax(e.target.value)} placeholder="—" className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Closed to arrival"><select value={cta} onChange={(e) => setCta(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">— No change —</option><option value="on">Closed</option><option value="off">Open</option></select></Field>
            <Field label="Closed to departure"><select value={ctd} onChange={(e) => setCtd(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">— No change —</option><option value="on">Closed</option><option value="off">Open</option></select></Field>
            <Field label="Rate plan status"><select value={stopSell} onChange={(e) => setStopSell(e.target.value as "" | "on" | "off")} className={inputCls}><option value="">— No change —</option><option value="off">Open (sell)</option><option value="on">Close (stop-sell)</option></select></Field>
          </div>
          <p className="text-[11px] text-ink-400">Min/max stay & advance: enter <span className="font-semibold">0</span> to clear an existing value.</p>
          {inlineError && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{inlineError}</p>}
          <button type="button" onClick={openPreview} className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            Preview &amp; apply
          </button>
        </div>
      </div>

      <Modal open={phase !== "closed"} onClose={() => setPhase("closed")} title={phase === "result" ? "Bulk update" : "Review bulk update"}>
        {phase === "confirm" && payload && (
          <div className="space-y-4">
            <div className="rounded-md border border-surface-border bg-surface-muted/60 px-3.5 py-3 text-[12.5px] text-ink-600">
              <div><span className="font-semibold text-ink-800">Room types:</span> {rtNames.join(", ")}</div>
              <div className="mt-0.5"><span className="font-semibold text-ink-800">Dates:</span> {dateFrom} → {dateTo} · {dowLabel}</div>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Changes to apply</span>
              <ul className="space-y-1.5">
                {summaryLines.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{l}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md border border-surface-border px-4 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">Cancel</button>
              <button type="button" onClick={apply} disabled={pending} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Applying…" : "Apply"}</button>
            </div>
          </div>
        )}
        {phase === "result" && result && (
          <div className="space-y-4">
            {result.ok ? (
              <div className="flex items-start gap-2.5 rounded-md bg-success-50 px-3.5 py-3 text-[13.5px] font-semibold text-success-600">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>Successful</div><div className="mt-0.5 text-[12px] font-medium text-success-600/90">Applied to {result.affected} cell{result.affected === 1 ? "" : "s"} and pushed to the connected channel manager.</div></div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md bg-danger-50 px-3.5 py-3 text-[13.5px] font-semibold text-danger-600">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><div>Not successful</div><div className="mt-0.5 text-[12px] font-medium text-danger-600/90">{result.error ?? "The update could not be applied."}</div></div>
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
              <button type="button" onClick={() => setPhase("closed")} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
