"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer, AlertTriangle, Loader2 } from "lucide-react";
import { DEFAULT_ERPNET_URL, readFiscalPrinter, writeFiscalPrinter, type FiscalPrinterChoice } from "./printer-config";

export type PrinterSetupStrings = {
  title: string;
  lead: string;
  address: string;
  find: string;
  finding: string;
  none: string;
  unreachable: string;
  choose: string;
  /** `{p}` is the printer. */
  current: string;
  notChosen: string;
  forget: string;
  checked: string;
};

type Found = { id: string; label: string };

/** Choose this computer's fiscal printer from what ErpNet.FP on this PC reports. */
export function PrinterSetup({ s }: { s: PrinterSetupStrings }) {
  const [url, setUrl] = useState(DEFAULT_ERPNET_URL);
  const [chosen, setChosen] = useState<FiscalPrinterChoice | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const c = readFiscalPrinter();
    setChosen(c);
    if (c) setUrl(c.url);
  }, []);

  async function find() {
    setBusy(true); setErr(null); setFound(null);
    try {
      const base = url.replace(/\/+$/, "");
      const list = (await fetch(`${base}/printers`).then((r) => r.json())) as Record<string, { manufacturer?: string; model?: string; serialNumber?: string }>;
      const rows = Object.entries(list).map(([id, p]) => ({ id, label: [p.manufacturer, p.model, p.serialNumber].filter(Boolean).join(" · ") || id }));
      setFound(rows);
      if (rows.length === 0) setErr(s.none);
    } catch {
      setErr(s.unreachable);
    } finally {
      setBusy(false);
    }
  }

  function choose(p: Found) {
    const v = { url: url.replace(/\/+$/, ""), printerId: p.id, label: p.label };
    writeFiscalPrinter(v);
    setChosen(v);
  }

  return (
    <div id="printer" className="rounded-md border border-surface-border p-3">
      <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900"><Printer className="h-3.5 w-3.5" /> {s.title}</h4>
      <p className="mt-1 text-[11.5px] text-ink-500">{s.lead}</p>
      <p className={`mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold ${chosen ? "text-success-600" : "text-ink-500"}`}>
        {chosen ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        {chosen ? s.current.replace("{p}", chosen.label) : s.notChosen}
        {chosen && (
          <button type="button" onClick={() => { writeFiscalPrinter(null); setChosen(null); }} className="ml-1 text-[11px] font-semibold text-ink-400 underline underline-offset-2 hover:text-danger-600">{s.forget}</button>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-ink-600">
          {s.address}
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-0.5 block h-8 w-56 rounded-md border border-surface-border bg-white px-2 text-[12px] outline-none focus:border-accent-600" />
        </label>
        <button type="button" onClick={() => void find()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-accent-500 px-3 text-[12px] font-semibold text-accent-600 hover:bg-accent-50 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} {busy ? s.finding : s.find}
        </button>
      </div>
      {err && <p className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] font-semibold text-warning-700"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {err}</p>}
      {found && found.length > 0 && (
        <ul className="mt-2 space-y-1">
          {found.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-surface-border px-2.5 py-1.5 text-[12px]">
              <span className="text-ink-800">{p.label}</span>
              {chosen?.printerId === p.id
                ? <span className="text-[11px] font-semibold text-success-600">{s.checked}</span>
                : <button type="button" onClick={() => choose(p)} className="rounded bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-100">{s.choose}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
