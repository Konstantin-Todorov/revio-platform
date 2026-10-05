"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle, ReceiptText } from "lucide-react";
import { recordFiscalReport } from "@/lib/actions-fiscal";
import { readFiscalPrinter } from "./printer-config";
import { runJob } from "./erpnet";

/** Plain strings (server → browser). `{t}` is a time. */
export type FiscalReportStrings = {
  title: string;
  lead: string;
  zDone: string;
  zDoneAt: string;
  zNotYet: string;
  printZ: string;
  confirmZ: string;
  confirmYes: string;
  cancel: string;
  printX: string;
  xDone: string;
  xDoneAt: string;
  printing: string;
  noPrinter: string;
  unreachable: string;
  uncertain: string;
  deviceSaid: string;
  onTill: string;
};

/**
 * The fiscal device's daily (Z) and interim (X) report, from Close Day.
 *
 * Z zeroes the device's day, so it asks once before printing — a second Z by mistake is a wasted
 * report and a confused accountant, not a disaster, but it is not undone either. X changes nothing
 * and prints straight away. The device keeps the report; we only note that it was printed.
 */
export function FiscalReportCard({ device, zAt, xAt, day, s }: {
  device: "none" | "erpnet";
  /** Today's last Z / X, already written as a time in the property's zone, or null. */
  zAt: string | null;
  xAt: string | null;
  /** The business day these reports belong to — part of each job's key. */
  day: string;
  s: FiscalReportStrings;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"z" | "x" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [printed, setPrinted] = useState<{ z: boolean; x: boolean }>({ z: false, x: false });

  async function run(kind: "z" | "x") {
    setConfirming(false);
    setMsg(null);
    const printer = readFiscalPrinter();
    if (!printer) { setMsg(s.noPrinter); return; }
    setBusy(kind);
    const o = await runJob(printer, kind === "z" ? "zreport" : "xreport", {}, `${kind}report-${day}`);
    setBusy(null);
    if (o.kind === "done") {
      await recordFiscalReport({ kind });
      setPrinted((p) => ({ ...p, [kind]: true }));
      return;
    }
    setMsg(o.kind === "device_error" && o.message ? s.deviceSaid.replace("{m}", o.message) : o.kind === "unreachable" ? s.unreachable : s.uncertain);
  }

  if (device !== "erpnet") {
    return (
      <div className="flex items-start gap-2 text-[12.5px] text-ink-600">
        <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" /> {s.onTill}
      </div>
    );
  }

  const zDone = printed.z || zAt;
  return (
    <div className="space-y-2.5">
      <p className="text-[12px] text-ink-500">{s.lead}</p>
      <p className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${zDone ? "text-success-600" : "text-warning-700"}`}>
        {zDone ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {!zDone ? s.zNotYet : !printed.z && zAt ? s.zDoneAt.replace("{t}", zAt) : s.zDone}
      </p>
      {(printed.x || xAt) && <p className="text-[11.5px] text-ink-500">{!printed.x && xAt ? s.xDoneAt.replace("{t}", xAt) : s.xDone}</p>}
      {msg && <p className="inline-flex items-start gap-1.5 text-[12px] font-semibold text-warning-700"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {msg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-[12px] font-semibold text-ink-700">{s.confirmZ}</span>
            <button type="button" onClick={() => void run("z")} className="rounded-md bg-brand-800 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700">{s.confirmYes}</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted">{s.cancel}</button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy !== null} onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-md border border-accent-500 px-3 py-1.5 text-[12px] font-semibold text-accent-600 hover:bg-accent-50 disabled:opacity-60">
              {busy === "z" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />} {busy === "z" ? s.printing : s.printZ}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void run("x")} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-600 hover:bg-surface-muted disabled:opacity-60">
              {busy === "x" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {busy === "x" ? s.printing : s.printX}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
