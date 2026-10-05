/**
 * The browser's side of ErpNet.FP (Net.FP protocol) — the one place that talks to the fiscal device.
 *
 * Every job is sent asynchronously with OUR task id and then followed by asking about that id, never
 * by sending it again. A lost answer therefore becomes "uncertain", which the screen says, instead of
 * a second receipt. The id in flight is kept in sessionStorage so a reload asks rather than reprints.
 */
import type { FiscalPrinterChoice } from "./printer-config";

export type DeviceResult = Record<string, unknown>;
export type JobOutcome =
  | { kind: "done"; result: DeviceResult }
  | { kind: "device_error"; message: string }
  | { kind: "unreachable" }
  | { kind: "uncertain" };

function session(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export const pendingKey = (key: string) => `revio.fiscal.pending.${key}`;
const attemptKey = (key: string) => `revio.fiscal.attempt.${key}`;

/** The device's own words for what went wrong, or "" when it gave none. */
export function deviceMessage(result: DeviceResult): string {
  const msgs = Array.isArray(result.messages) ? (result.messages as { type?: string; text?: string }[]) : [];
  return msgs.find((m) => m.type === "error")?.text ?? msgs[0]?.text ?? "";
}

/** Ask about a task until it finishes. */
export async function followTask(url: string, taskId: string, key: string): Promise<JobOutcome> {
  for (let i = 0; i < 90; i++) {
    let info: DeviceResult;
    try {
      info = await fetch(`${url}/printers/taskinfo?id=${encodeURIComponent(taskId)}`).then((r) => r.json());
    } catch {
      return { kind: "uncertain" };
    }
    const status = String(info.taskStatus ?? "");
    if (status === "finished") {
      session()?.removeItem(pendingKey(key));
      const result = (info.result ?? {}) as DeviceResult;
      return String(result.ok) === "true" ? { kind: "done", result } : { kind: "device_error", message: deviceMessage(result) };
    }
    if (status === "unknown") {
      session()?.removeItem(pendingKey(key));
      return { kind: "uncertain" };
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return { kind: "uncertain" };
}

/**
 * Send one job (`receipt`, `reversalreceipt`, `zreport`, `xreport`) and follow it.
 * `key` names the thing being printed (a payment line, a storno, a report day); each call is a new
 * attempt with a new task id, because a job the device REFUSED was not printed and may be retried.
 */
export async function runJob(printer: FiscalPrinterChoice, path: string, body: unknown, key: string): Promise<JobOutcome> {
  const ss = session();
  const attempt = Number(ss?.getItem(attemptKey(key)) ?? "0") + 1;
  ss?.setItem(attemptKey(key), String(attempt));
  const taskId = `${key}-${attempt}`;
  try {
    const res = await fetch(`${printer.url}/printers/${encodeURIComponent(printer.printerId)}/${path}?asyncTimeout=0&taskId=${encodeURIComponent(taskId)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return { kind: "unreachable" };
    ss?.setItem(pendingKey(key), JSON.stringify({ url: printer.url, taskId }));
  } catch {
    return { kind: "unreachable" };
  }
  return followTask(printer.url, taskId, key);
}

/** A job left in flight by a reload, if any. */
export function pendingJob(key: string): { url: string; taskId: string } | null {
  try { return JSON.parse(session()?.getItem(pendingKey(key)) ?? "null"); } catch { return null; }
}

/** Integer cents → the device's decimal. The only place money becomes a float, and only on the wire. */
export const toDevice = (minor: number) => Number((minor / 100).toFixed(2));
