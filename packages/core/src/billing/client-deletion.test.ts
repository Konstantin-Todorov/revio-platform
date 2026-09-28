import { describe, it, expect } from "vitest";
import { canDeleteClient, type ClientDeletionFacts } from "./client-deletion.js";
import { RETENTION_DAYS } from "./client-lifecycle.js";

const NOW = new Date("2026-09-28T10:00:00Z");
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base: ClientDeletionFacts = {
  accountType: "live", status: "active", closedAt: null, now: NOW,
  taxInvoices: 0, reservations: 0, liveRemoteChannels: 0,
};

describe("canDeleteClient — ours", () => {
  it("removes a test account at any time, whatever it holds", () => {
    // The founder's complaint: demo and test accounts could not be removed because of rehearsal invoices.
    expect(canDeleteClient({ ...base, accountType: "test", reservations: 40 })).toEqual({ ok: true, severity: "harmless" });
  });

  it("removes a demo account, with a word about the nightly refresh", () => {
    const v = canDeleteClient({ ...base, accountType: "demo", reservations: 65 });
    expect(v.ok && v.severity).toBe("destructive");
    expect(v.ok && v.warning).toMatch(/demo/i);
  });

  it("says a real-series invoice on an account of ours is kept, not that it blocks", () => {
    const v = canDeleteClient({ ...base, accountType: "test", taxInvoices: 1 });
    expect(v).toEqual({ ok: true, severity: "harmless", keepsInvoices: 1 });
  });
});

describe("canDeleteClient — a real client", () => {
  it("lets a live account that never traded go", () => {
    const v = canDeleteClient({ ...base });
    expect(v.ok && v.severity).toBe("destructive");
  });

  it("an unconfirmed signup is harmless to remove", () => {
    expect(canDeleteClient({ ...base, status: "pending_signup" })).toEqual({ ok: true, severity: "harmless" });
  });

  it("⚠️ refuses a client who traded and is not closed, and says to close instead", () => {
    for (const status of ["active", "suspended"]) {
      const v = canDeleteClient({ ...base, accountType: "pilot", status, reservations: 3 });
      expect(v.ok).toBe(false);
      if (v.ok) continue;
      expect(v.instead).toMatch(/close the client/i);
      expect(v.instead).toMatch(new RegExp(`${RETENTION_DAYS} days`));
    }
  });

  it("keeps a closed client for the retention window and names the date it can go", () => {
    const v = canDeleteClient({ ...base, status: "closed", closedAt: days(10), reservations: 3 });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    const expected = new Date(days(10).getTime() + RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
    expect(v.instead).toContain(expected);
  });

  it("allows it after the window, and says the tax invoices stay", () => {
    const v = canDeleteClient({ ...base, status: "closed", closedAt: days(RETENTION_DAYS + 1), reservations: 3, taxInvoices: 4 });
    expect(v.ok).toBe(true);
    expect(v.ok && v.keepsInvoices).toBe(4);
  });

  it("a tax invoice alone is evidence of trading — no deleting a billed client on day one", () => {
    expect(canDeleteClient({ ...base, taxInvoices: 1 }).ok).toBe(false);
  });
});

describe("a channel still switched on at the channel manager", () => {
  /*
   * ⚠️ The refusal that matters most, because it is the only one where something keeps RUNNING
   * after the row is gone: the channel stays live with the OTA and billed to us every month.
   */
  it("refuses outright, and names the one step that clears it", () => {
    const v = canDeleteClient({ ...base, liveRemoteChannels: 1 });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reason).toMatch(/still switched on/i);
    expect(v.instead).toMatch(/disconnect/i);
  });

  it("outranks every other check — even for a test account", () => {
    expect(canDeleteClient({ ...base, accountType: "test", liveRemoteChannels: 2 }).ok).toBe(false);
    expect(canDeleteClient({ ...base, status: "pending_signup", liveRemoteChannels: 1 }).ok).toBe(false);
  });
});
