"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Printer, AlertTriangle, Loader2 } from "lucide-react";
import { saveFiscalReceipt, recordManualReceipt } from "@/lib/actions-fiscal";
import { readFiscalPrinter } from "./printer-config";
import { SubmitButton } from "@revio/ui/submit-button";

/**
 * The fiscal-receipt line under a desk payment (docs/specs/FISCAL-PRINTER.md).
 *
 * The browser is the only thing that can reach both us and the printer on the hotel's desk, so this
 * component — not our server — sends the receipt to ErpNet.FP on `localhost` and hands the device's
 * answer back. Three states, and only the middle one asks for anything:
 *   „Бон № 0000085“ · „Бонът не е отпечатан — …“ · (nothing, when no receipt is required).
 *
 * Never two receipts for one payment: every attempt has its own ErpNet.FP task id, the id in flight
 * is kept in sessionStorage so a reload ASKS about that task instead of printing again, and the server
 * refuses to overwrite a recorded number.
 */
export type FiscalReceiptPayload = {
  items: { text: string; taxGroup: number; amountMinor: number }[];
  paymentType: "cash" | "card";
  totalMinor: number;
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
};

type State =
  | { k: "idle" }
  | { k: "printing" }
  | { k: "error"; msg: string; uncertain?: boolean };

const PENDING = (lineId: string) => `revio.fiscal.pending.${lineId}`;
const ATTEMPT = (lineId: string) => `revio.fiscal.attempt.${lineId}`;

function store(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function FiscalReceiptRow({ lineId, receipt, recorded, device, autoPrint, s }: {
  lineId: string;
  receipt: FiscalReceiptPayload | null;
  recorded: { no: string; source: string | null } | null;
  device: "none" | "erpnet";
  autoPrint: boolean;
  s: FiscalRowStrings;
}) {
  const [state, setState] = useState<State>({ k: "idle" });
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(false);

  const finish = useCallback(async (result: Record<string, unknown>) => {
    const ok = String(result.ok) === "true";
    const no = result.receiptNumber ? String(result.receiptNumber) : "";
    if (!ok || !no) {
      const msgs = Array.isArray(result.messages) ? (result.messages as { type?: string; text?: string }[]) : [];
      const err = msgs.find((m) => m.type === "error")?.text ?? msgs[0]?.text ?? "";
      setState({ k: "error", msg: err ? s.deviceSaid.replace("{m}", err) : s.unreachable });
      return;
    }
    const saved = await saveFiscalReceipt({
      lineId, receiptNumber: no,
      receiptDateTime: result.receiptDateTime ? String(result.receiptDateTime) : null,
      fiscalMemorySerialNumber: result.fiscalMemorySerialNumber ? String(result.fiscalMemorySerialNumber) : null,
    });
    store()?.removeItem(PENDING(lineId));
    if (saved.ok || saved.reason === "already") { setDone(no); setState({ k: "idle" }); }
    else setState({ k: "error", msg: s.uncertain, uncertain: true });
  }, [lineId, s]);

  /** Ask ErpNet.FP about a task until it finishes. A lost answer is "uncertain", never "print again". */
  const follow = useCallback(async (url: string, taskId: string) => {
    for (let i = 0; i < 90; i++) {
      let info: Record<string, unknown>;
      try {
        info = await fetch(`${url}/printers/taskinfo?id=${encodeURIComponent(taskId)}`).then((r) => r.json());
      } catch {
        setState({ k: "error", msg: s.unreachable, uncertain: true });
        return;
      }
      const status = String(info.taskStatus ?? "");
      if (status === "finished") return finish((info.result ?? {}) as Record<string, unknown>);
      if (status === "unknown") {
        store()?.removeItem(PENDING(lineId));
        setState({ k: "error", msg: s.uncertain, uncertain: true });
        return;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    setState({ k: "error", msg: s.uncertain, uncertain: true });
  }, [finish, lineId, s]);

  const print = useCallback(async () => {
    if (!receipt) return;
    const printer = readFiscalPrinter();
    if (!printer) { setState({ k: "error", msg: s.noPrinter }); return; }
    const ss = store();
    const attempt = Number(ss?.getItem(ATTEMPT(lineId)) ?? "0") + 1;
    ss?.setItem(ATTEMPT(lineId), String(attempt));
    const taskId = `${lineId}-${attempt}`;
    // The device's decimal format is produced HERE, at the edge, from integer cents.
    const body = {
      items: receipt.items.map((i) => ({ text: i.text, quantity: 1, unitPrice: Number((i.amountMinor / 100).toFixed(2)), taxGroup: i.taxGroup })),
      payments: [{ amount: Number((receipt.totalMinor / 100).toFixed(2)), paymentType: receipt.paymentType }],
    };
    setState({ k: "printing" });
    try {
      const res = await fetch(`${printer.url}/printers/${encodeURIComponent(printer.printerId)}/receipt?asyncTimeout=0&taskId=${encodeURIComponent(taskId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      ss?.setItem(PENDING(lineId), JSON.stringify({ url: printer.url, taskId }));
    } catch {
      setState({ k: "error", msg: s.unreachable });
      return;
    }
    await follow(printer.url, taskId);
  }, [follow, lineId, receipt, s]);

  useEffect(() => {
    if (started.current || recorded || !receipt || device !== "erpnet") return;
    started.current = true;
    // A task already in flight for this payment (the page was reloaded mid-print): ask, don't print.
    const pending = store()?.getItem(PENDING(lineId));
    if (pending) {
      try { const p = JSON.parse(pending) as { url: string; taskId: string }; setState({ k: "printing" }); void follow(p.url, p.taskId); return; } catch { /* fall through */ }
    }
    if (autoPrint) void print();
  }, [autoPrint, device, follow, lineId, print, receipt, recorded]);

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
