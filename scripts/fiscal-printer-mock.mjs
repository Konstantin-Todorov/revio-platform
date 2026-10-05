#!/usr/bin/env node
/**
 * A stand-in for ErpNet.FP, for local development and demos — NOT a fiscal device.
 *
 * Speaks the parts of the Net.FP protocol the PMS uses (docs/specs/FISCAL-PRINTER.md): list printers,
 * print a receipt asynchronously with a caller-chosen taskId, and report the task. Receipt numbers are
 * prefixed `MOCK` so nothing it returns can be mistaken for a real receipt in the database.
 *
 *   node scripts/fiscal-printer-mock.mjs            # http://localhost:8001
 *   FAIL=paper node scripts/fiscal-printer-mock.mjs # every receipt fails like a printer out of paper
 */
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8001);
const FAIL = process.env.FAIL ?? "";
const PRINTERS = {
  mk000001: { uri: "mock://desk", serialNumber: "MK000001", fiscalMemorySerialNumber: "MOCK0001", manufacturer: "Mock", model: "Desk printer (not fiscal)", itemTextMaxLength: 22, supportedPaymentTypes: ["cash", "card"] },
};
const tasks = new Map(); // taskId → { status, result }
const printed = []; // what would have come out of the printer, for inspection
let counter = 0;

function send(res, code, body, origin) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") return send(res, 204, undefined, origin);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/printers") return send(res, 200, PRINTERS, origin);
  if (req.method === "GET" && url.pathname === "/printers/taskinfo") {
    const t = tasks.get(url.searchParams.get("id"));
    if (!t) return send(res, 200, { taskStatus: "unknown" }, origin);
    if (t.status === "finished") tasks.delete(url.searchParams.get("id"));
    return send(res, 200, { taskStatus: t.status, result: t.result }, origin);
  }
  if (req.method === "GET" && url.pathname === "/printed") return send(res, 200, printed, origin);

  // Z / X reports: nothing comes back but the status, as with the real one.
  if (req.method === "POST" && parts[0] === "printers" && (parts[2] === "zreport" || parts[2] === "xreport")) {
    const taskId = url.searchParams.get("taskId") || `t${Date.now()}`;
    if (!tasks.has(taskId)) {
      tasks.set(taskId, { status: "running" });
      setTimeout(() => {
        tasks.set(taskId, { status: "finished", result: FAIL === "paper" ? { ok: "false", messages: [{ type: "error", code: "E301", text: "Няма хартия" }] } : { ok: "true", messages: [] } });
        printed.push({ taskId, report: parts[2] });
        console.log(`printed ${parts[2]}`);
      }, 900);
    }
    return send(res, 200, { taskId }, origin);
  }

  if (req.method === "POST" && parts[0] === "printers" && (parts[2] === "receipt" || parts[2] === "reversalreceipt")) {
    if (!PRINTERS[parts[1]]) return send(res, 404, { ok: "false", messages: [{ type: "error", code: "E404", text: "Printer not found" }] }, origin);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const taskId = url.searchParams.get("taskId") || `t${Date.now()}`;
    // Idempotent like the real one: a known taskId is not printed twice.
    if (!tasks.has(taskId)) {
      tasks.set(taskId, { status: "running" });
      setTimeout(() => {
        const sum = (body.items ?? []).reduce((a, i) => a + Math.round((i.unitPrice ?? 0) * 100) * (i.quantity ?? 1), 0);
        const paid = (body.payments ?? []).reduce((a, p) => a + Math.round(p.amount * 100), 0);
        if (parts[2] === "reversalreceipt" && !(body.receiptNumber && body.fiscalMemorySerialNumber && body.reason)) {
          tasks.set(taskId, { status: "finished", result: { ok: "false", messages: [{ type: "error", code: "E405", text: "Reversal needs the original receipt number, date, FM serial and a reason" }] } });
        } else if (FAIL === "paper") {
          tasks.set(taskId, { status: "finished", result: { ok: "false", messages: [{ type: "error", code: "E301", text: "Няма хартия" }] } });
        } else if (sum !== paid) {
          tasks.set(taskId, { status: "finished", result: { ok: "false", messages: [{ type: "error", code: "E410", text: `Items ${sum} ≠ payments ${paid}` }] } });
        } else {
          counter += 1;
          const result = { ok: "true", messages: [], receiptNumber: `MOCK${String(counter).padStart(6, "0")}`, receiptDateTime: new Date().toISOString().slice(0, 19), receiptAmount: paid / 100, fiscalMemorySerialNumber: PRINTERS[parts[1]].fiscalMemorySerialNumber };
          printed.push({ taskId, ...body, ...result });
          tasks.set(taskId, { status: "finished", result });
          console.log(`printed ${parts[2] === "reversalreceipt" ? `STORNO of ${body.receiptNumber} (${body.reason}) ` : ""}${result.receiptNumber}: ${(body.items ?? []).map((i) => `${i.text} ${i.unitPrice} [${i.taxGroup}]`).join(" | ")} = ${paid / 100} ${body.payments?.[0]?.paymentType}`);
        }
      }, 900);
    }
    return send(res, 200, { taskId }, origin);
  }
  send(res, 404, { ok: "false" }, origin);
}).listen(PORT, () => console.log(`fiscal printer MOCK on http://localhost:${PORT}${FAIL ? ` (failing: ${FAIL})` : ""}`));
