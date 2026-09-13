import { describe, expect, it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { comparePublished, summarisePublished } from "@revio/connectivity";

/**
 * The three outcomes the strip must be able to show.
 *
 *     VERIFY_PREVIEW=/tmp/verify.html VERIFY_CSS=/tmp/cm.css pnpm --filter @revio/channel-manager test
 */

const ours = (over = {}) => ({
  externalRateId: "1br-bar", date: "2026-09-20", priceMinor: 66600,
  roomTypeName: "Apartment, 1 Bedroom", ratePlanName: "BB Flex", ...over,
});

describe("verify outcomes", () => {
  it("⚠️ the €666 fault produces two findings that name each other", () => {
    const s = summarisePublished(comparePublished(
      [ours()],
      [{ externalRateId: "1br-bar", date: "2026-09-20", priceMinor: 15000 },
       { externalRateId: "2br-bar", date: "2026-09-20", priceMinor: 66600 }],
    ));
    expect(s.headline).toContain("1 published at a different price");
    expect(s.headline).toContain("1 published that we did not send");
  });

  it("says so plainly when everything agrees", () => {
    const s = summarisePublished(comparePublished([ours()], [{ externalRateId: "1br-bar", date: "2026-09-20", priceMinor: 66600 }]));
    expect(s.headline).toMatch(/publishing exactly what we sent/);
  });

  it("⚠️ an empty check is NOT a clean bill of health", () => {
    expect(summarisePublished([]).headline).toMatch(/Nothing to check/);
  });

  it("writes a preview when asked", () => {
    const out = process.env.VERIFY_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.VERIFY_CSS!, "utf8");
    const money = (m: number | null) => (m == null ? "—" : `€${(m / 100).toLocaleString("en-US")}`);

    const bad = summarisePublished(comparePublished(
      [ours(), ours({ date: "2026-09-21", priceMinor: 12278 })],
      [{ externalRateId: "1br-bar", date: "2026-09-20", priceMinor: 15000 },
       { externalRateId: "2br-bar", date: "2026-09-20", priceMinor: 66600 }],
    ));
    const good = summarisePublished(comparePublished([ours()], [{ externalRateId: "1br-bar", date: "2026-09-20", priceMinor: 66600 }]));

    const strip = (inner: string) =>
      `<div class="mb-3 rounded-md border border-surface-border bg-white px-4 py-3">` +
      `<div class="flex flex-wrap items-center gap-x-3 gap-y-2"><span class="text-[12.5px] text-ink-600">Read back what <strong class="font-semibold text-ink-800">Channex</strong> is publishing right now, and compare it with what we hold.</span>` +
      `<button class="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-3 text-[12px] font-semibold text-ink-700">Verify</button></div>${inner}</div>`;

    const findings = (s: typeof bad) =>
      `<div class="mt-2"><p class="flex items-start gap-1.5 rounded-md px-2.5 py-2 text-[12.5px] ${s.examples.length ? "bg-warning-50 text-warning-800" : "bg-success-50 text-success-700"}">` +
      `<span>${s.headline}<span class="ml-1 text-ink-400">· 2026-09-13 → 2026-09-27</span></span></p>` +
      (s.examples.length
        ? `<ul class="mt-1.5 space-y-1 pl-6 text-[12px] text-ink-600">` + s.examples.map((e) =>
            `<li class="tnum"><span class="font-semibold text-ink-800">${e.roomTypeName ? `${e.roomTypeName} · ${e.ratePlanName}` : "A plan we did not send to"}</span> ${e.date} — ` +
            (e.kind === "missing" ? `we have ${money(e.ours)}, they have nothing`
              : e.kind === "unexpected" ? `they publish ${money(e.theirs)}, we sent nothing`
              : `we have ${money(e.ours)}, they publish ${money(e.theirs)}`) + `</li>`).join("") + `</ul>`
        : "") + `</div>`;

    const err = `<p class="mt-2 flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-2 text-[12.5px] text-danger-700">Channex 401 reading published rates</p>`;

    writeFileSync(out, `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
      `<div class="bg-surface-page p-6" style="max-width:860px">` +
      `<p class="mb-1 text-[11px] font-bold uppercase text-ink-400">A · mismatch found</p>${strip(findings(bad))}` +
      `<p class="mb-1 mt-5 text-[11px] font-bold uppercase text-ink-400">B · everything agrees</p>${strip(findings(good))}` +
      `<p class="mb-1 mt-5 text-[11px] font-bold uppercase text-ink-400">C · could not look — never shown as a clean result</p>${strip(err)}` +
      `</div></body>`);
  });
});
