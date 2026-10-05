"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Printer, AlertTriangle, Loader2, Undo2 } from "lucide-react";
import { saveFiscalReceipt, recordManualReceipt, saveFiscalStorno, recordManualStorno } from "@/lib/actions-fiscal";
import { readFiscalPrinter } from "./printer-config";
import { runJob, followTask, pendingJob, toDevice, type JobOutcome } from "./erpnet";
import { SubmitButton } from "@revio/ui/submit-button";

/**
 * The fiscal line under a desk payment (docs/specs/FISCAL-PRINTER.md).
 *
 * The browser is the only thing that reaches both us and the printer on the desk, so this component —
 * not our server — talks to ErpNet.FP and hands the device's answer back. A payment shows one of:
 *   „Касов бон № …“ · „Бонът не е отпечатан — …“ · nothing (no receipt required).
 * A VOIDED payment that had a receipt shows its storno instead: done, or still owed — because voiding
 * corrects our record and only a storno corrects the device's.
 */
export type FiscalReceiptPayload = {
  items: { text: string; taxGroup: number; amountMinor: number }[];
  paymentType: "cash" | "card";
  totalMinor: number;
};

export type StornoOriginal = {
  items: { text: string; taxGroup: number; amountMinor: number }[];
  paymentType: "cash" | "card";
  receiptNumber: string;
  receiptDateTime: string | null;
  fiscalMemorySerialNumber: string | null;
};

/** Plain strings — these cross from the server to the browser, so no functions; `{n}` / `{m}` are filled here. */
export type FiscalRowStrings = {
  recorded: string;
  recordedManual: string;
  printing: string;
  needed: string;
  print: string;
  printAgain: string;
  noPrinter: string;
  setUp: string;
  unreachable: string;
  uncertain: string;
  deviceSaid: string;
  manualPlaceholder: string;
  manualSave: string;
  orTypeIt: string;
  stornoNeeded: string;
  stornoReason: string;
  reasonOperator: string;
  reasonRefund: string;
  printStorno: string;
  stornoDone: string;
  stornoDoneManual: string;
};

type State = { k: "idle" } | { k: "printing" } | { k: "error"; msg: string };

export function FiscalReceiptRow({ lineId, receipt, recorded, storno, device, autoPrint, s }: {
  lineId: string;
  receipt: FiscalReceiptPayload | null;
  recorded: { no: string; source: string | null } | null;
  /** Present only for a voided payment that had a receipt. */
  storno: { done: { no: string; source: string | null } | null; original: StornoOriginal | null } | null;
  device: "none" | "erpnet";
  autoPrint: boolean;
  s: FiscalRowStrings;
}) {
  const [state, setState] = useState<State>({ k: "idle" });
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState<"operator_error" | "refund">("operator_error");
  const started = useRef(false);
  const key = storno ? `storno-${lineId}` : lineId;

  const say = useCallback((o: Exclude<JobOutcome, { kind: "done" }>) => {
    if (o.kind === "device_error") return o.message ? s.deviceSaid.replace("{m}", o.message) : s.unreachable;
    return o.kind === "unreachable" ? s.unreachable : s.uncertain;
  }, [s]);

  /** What happens once the device answered: store its number, or say what it said. */
  const settle = useCallback(async (o: JobOutcome) => {
    if (o.kind !== "done") { setState({ k: "error", msg: say(o) }); return; }
    const no = o.result.receiptNumber ? String(o.result.receiptNumber) : "";
    if (!no) { setState({ k: "error", msg: s.uncertain }); return; }
    const at = o.result.receiptDateTime ? String(o.result.receiptDateTime) : null;
    const saved = storno
      ? await saveFiscalStorno({ lineId, receiptNumber: no, receiptDateTime: at, reason })
      : await saveFiscalReceipt({
          lineId, receiptNumber: no, receiptDateTime: at,
          fiscalMemorySerialNumber: o.result.fiscalMemorySerialNumber ? String(o.result.fiscalMemorySerialNumber) : null,
          printed: receipt ? { items: receipt.items, paymentType: receipt.paymentType } : undefined,
        });
    if (saved.ok || saved.reason === "already") { setDone(no); setState({ k: "idle" }); }
    else setState({ k: "error", msg: s.uncertain });
  }, [lineId, reason, receipt, s, say, storno]);

  const print = useCallback(async () => {
    const printer = readFiscalPrinter();
    if (!printer) { setState({ k: "error", msg: s.noPrinter }); return; }
    let path: string;
    let body: unknown;
    if (storno) {
      const o = storno.original;
      if (!o) return;
      path = "reversalreceipt";
      body = {
        receiptNumber: o.receiptNumber, receiptDateTime: o.receiptDateTime, fiscalMemorySerialNumber: o.fiscalMemorySerialNumber,
        reason: reason === "refund" ? "refund" : "operator-error",
        items: o.items.map((i) => ({ text: i.text, quantity: 1, unitPrice: toDevice(i.amountMinor), taxGroup: i.taxGroup })),
        payments: [{ amount: toDevice(o.items.reduce((a, i) => a + i.amountMinor, 0)), paymentType: o.paymentType }],
      };
    } else {
      if (!receipt) return;
      path = "receipt";
      body = {
        items: receipt.items.map((i) => ({ text: i.text, quantity: 1, unitPrice: toDevice(i.amountMinor), taxGroup: i.taxGroup })),
        payments: [{ amount: toDevice(receipt.totalMinor), paymentType: receipt.paymentType }],
      };
    }
    setState({ k: "printing" });
    await settle(await runJob(printer, path, body, key));
  }, [key, reason, receipt, s, settle, storno]);

  useEffect(() => {
    if (started.current || device !== "erpnet") return;
    if (storno ? storno.done : recorded) return;
    started.current = true;
    // A job left in flight by a reload: ask about it, never send it again.
    const pending = pendingJob(key);
    if (pending) { setState({ k: "printing" }); void followTask(pending.url, pending.taskId, key).then(settle); return; }
    if (!storno && autoPrint && receipt) void print();
  }, [autoPrint, device, key, print, receipt, recorded, settle, storno]);

  // ── A storno owed or done ──────────────────────────────────────────────────────────────
  if (storno) {
    const no = done ?? storno.done?.no ?? null;
    if (no) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-500">
          <Undo2 className="h-3.5 w-3.5" /> {(storno.done?.source === "manual" && !done ? s.stornoDoneManual : s.stornoDone).replace("{n}", no)}
        </span>
      );
    }
    return (
      <div className="mt-1.5 w-full rounded-md bg-warning-50 px-2.5 py-2 text-[11.5px] text-ink-700">
        {state.k === "printing" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {s.printing}</span>
        ) : (
          <>
            <span className="inline-flex items-start gap-1.5 font-semibold text-warning-700">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {state.k === "error" ? state.msg : s.stornoNeeded}
            </span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-ink-600">
                {s.stornoReason}
                <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="h-7 rounded border border-surface-border bg-white px-1.5 text-[11.5px]">
                  <option value="operator_error">{s.reasonOperator}</option>
                  <option value="refund">{s.reasonRefund}</option>
                </select>
              </label>
              {device === "erpnet" && storno.original && (
                <button type="button" onClick={() => void print()} className="inline-flex items-center gap-1 rounded-md border border-accent-500 bg-white px-2 py-1 text-[11.5px] font-semibold text-accent-600 hover:bg-accent-50">
                  <Printer className="h-3.5 w-3.5" /> {s.printStorno}
                </button>
              )}
              <form action={recordManualStorno} className="flex items-center gap-1.5">
                {device === "erpnet" && storno.original && <span className="text-ink-500">{s.orTypeIt}</span>}
                <input type="hidden" name="lineId" value={lineId} />
                <input type="hidden" name="reason" value={reason} />
                <input name="receiptNumber" required maxLength={40} placeholder={s.manualPlaceholder} className="h-7 w-32 rounded border border-surface-border bg-white px-2 text-[11.5px] outline-none focus:border-accent-600" />
                <SubmitButton className="h-7 rounded bg-surface-muted px-2 text-[11px] font-semibold text-ink-700 hover:bg-ink-100">{s.manualSave}</SubmitButton>
              </form>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── A receipt done or owed ─────────────────────────────────────────────────────────────
  const no = done ?? recorded?.no ?? null;
  if (no) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> {(recorded?.source === "manual" && !done ? s.recordedManual : s.recorded).replace("{n}", no)}
      </span>
    );
  }
  if (!receipt) return null;

  return (
    <div className="mt-1.5 w-full rounded-md bg-warning-50 px-2.5 py-2 text-[11.5px] text-ink-700">
      {state.k === "printing" ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {s.printing}</span>
      ) : (
        <>
          <span className="inline-flex items-start gap-1.5 font-semibold text-warning-700">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {state.k === "error" ? state.msg : s.needed}
          </span>
          {state.k === "error" && state.msg === s.noPrinter && (
            <a href="/configuration/compliance#printer" className="ml-1.5 font-semibold text-accent-600 underline underline-offset-2">{s.setUp}</a>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {device === "erpnet" && (
              <button type="button" onClick={() => void print()} className="inline-flex items-center gap-1 rounded-md border border-accent-500 bg-white px-2 py-1 text-[11.5px] font-semibold text-accent-600 hover:bg-accent-50">
                <Printer className="h-3.5 w-3.5" /> {state.k === "error" ? s.printAgain : s.print}
              </button>
            )}
            <form action={recordManualReceipt} className="flex items-center gap-1.5">
              {device === "erpnet" && <span className="text-ink-500">{s.orTypeIt}</span>}
              <input type="hidden" name="lineId" value={lineId} />
              <input name="receiptNumber" required maxLength={40} placeholder={s.manualPlaceholder} className="h-7 w-32 rounded border border-surface-border bg-white px-2 text-[11.5px] outline-none focus:border-accent-600" />
              <SubmitButton className="h-7 rounded bg-surface-muted px-2 text-[11px] font-semibold text-ink-700 hover:bg-ink-100">{s.manualSave}</SubmitButton>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
