"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Settings2 } from "lucide-react";

/**
 * The dashboard's preset row + KPI grid, customizable PER USER (spec §3.1: "let the customer
 * set his own view"): which period presets show and which KPI cards show, persisted in
 * localStorage. All numbers arrive pre-computed from the server — this component only
 * filters what renders.
 */

export interface PresetOpt {
  key: string;
  label: string;
}

export interface KpiCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  href: string;
  /** Year-over-year vs STLY (364 days back): display string + direction. Null = no baseline. */
  yoy: { text: string; dir: "up" | "down" | "flat" } | null;
}

const STORE = "crs-dash-view";

type Prefs = { presets: string[]; cards: string[] };

export function DashboardView({
  presets, activePreset, cards, basis, customStart, customEnd,
}: {
  presets: PresetOpt[];
  activePreset: string;
  cards: KpiCard[];
  basis: "yoy" | "lw";
  customStart: string;
  customEnd: string;
}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [open, setOpen] = useState(false);

  // Persist the comparison basis per user (§1.2). The URL param is the source of truth for the server;
  // localStorage remembers the last pick for continuity across visits.
  useEffect(() => {
    try { localStorage.setItem("crs-dash-basis", basis); } catch { /* ignore */ }
  }, [basis]);

  // Build a basis-toggle href that preserves the current range.
  const basisHref = (b: "yoy" | "lw") => {
    const p = new URLSearchParams();
    if (activePreset === "custom") { p.set("range", "custom"); if (customStart) p.set("from", customStart); if (customEnd) p.set("to", customEnd); }
    else p.set("range", activePreset);
    p.set("basis", b);
    return `/dashboard?${p.toString()}`;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      setPrefs(raw ? (JSON.parse(raw) as Prefs) : { presets: presets.map((p) => p.key), cards: cards.map((c) => c.key) });
    } catch {
      setPrefs({ presets: presets.map((p) => p.key), cards: cards.map((c) => c.key) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  };
  const toggle = (kind: keyof Prefs, key: string) => {
    if (!prefs) return;
    const list = prefs[kind].includes(key) ? prefs[kind].filter((k) => k !== key) : [...prefs[kind], key];
    if (list.length === 0) return; // never hide everything
    save({ ...prefs, [kind]: list });
  };

  const shownPresets = presets.filter((p) => !prefs || prefs.presets.includes(p.key) || p.key === activePreset);
  const shownCards = cards.filter((c) => !prefs || prefs.cards.includes(c.key));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {shownPresets.map((p) => (
          <Link
            key={p.key}
            href={`/dashboard?range=${p.key}`}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              activePreset === p.key ? "bg-brand-800 text-white" : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <form method="GET" className="ml-1 flex items-center gap-1.5">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={customStart} className="rounded-md border border-surface-border bg-white px-2 py-1.5 text-[12px]" />
          <span className="text-[11px] text-ink-400">→</span>
          <input type="date" name="to" defaultValue={customEnd} className="rounded-md border border-surface-border bg-white px-2 py-1.5 text-[12px]" />
          <button className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted">Apply</button>
        </form>

        {/* Comparison basis toggle (§1.2): governs every card's delta at once. */}
        <div className="ml-2 flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-ink-400">Compared with</span>
          <div className="flex items-center gap-0.5 rounded-md border border-surface-border bg-white p-0.5">
            {([["yoy", "Last year"], ["lw", "Last week"]] as const).map(([b, label]) => (
              <Link
                key={b}
                href={basisHref(b)}
                className={`rounded px-2 py-1 text-[11.5px] font-semibold transition-colors ${basis === b ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted"
          >
            <Settings2 className="h-3.5 w-3.5" /> Customize view
          </button>
          {open && (
            <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-surface-border bg-white p-3 shadow-lg">
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Period presets</div>
              <div className="mb-2 grid grid-cols-2 gap-1">
                {presets.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-700">
                    <input type="checkbox" checked={!prefs || prefs.presets.includes(p.key)} onChange={() => toggle("presets", p.key)} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                    {p.label}
                  </label>
                ))}
              </div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">KPI cards</div>
              <div className="grid grid-cols-2 gap-1">
                {cards.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-700">
                    <input type="checkbox" checked={!prefs || prefs.cards.includes(c.key)} onChange={() => toggle("cards", c.key)} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                    {c.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 border-t border-surface-border pt-2 text-[10.5px] text-ink-400">Saved on this device, per user.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {shownCards.map((card) => (
          <Link key={card.key} href={card.href} className="block">
            <Card605 label={card.label} value={card.value} sub={card.sub} yoy={card.yoy} basis={basis} />
          </Link>
        ))}
      </div>
    </>
  );
}

function Card605({ label, value, sub, yoy, basis }: Pick<KpiCard, "label" | "value" | "sub" | "yoy"> & { basis: "yoy" | "lw" }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white px-4 py-3.5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
        {/* Delta vs the chosen basis (§1.2): gain = green ▲, drop = red ▼. */}
        {yoy && (
          <span
            title={basis === "lw" ? "vs last week (7 days back — same weekday)" : "vs same time last year (364 days back — same weekday)"}
            className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10.5px] font-bold tabular-nums ${
              yoy.dir === "up" ? "bg-success-50 text-success-600" : yoy.dir === "down" ? "bg-danger-50 text-danger-600" : "bg-surface-sunken text-ink-400"
            }`}
          >
            {yoy.dir === "up" && <ArrowUp className="h-3 w-3" />}
            {yoy.dir === "down" && <ArrowDown className="h-3 w-3" />}
            {yoy.text}
          </span>
        )}
      </div>
      <div className="tnum mt-1 text-[24px] font-bold leading-none text-ink-900">{value}</div>
      <div className="mt-1.5 text-[11.5px] text-ink-400">{sub}</div>
    </div>
  );
}
