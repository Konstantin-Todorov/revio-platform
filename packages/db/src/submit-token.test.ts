import { describe, expect, it } from "vitest";
import { claimSubmitToken, SUBMIT_TOKEN_FIELD, type SubmitTokenDb } from "./submit-token.js";

/** The primary key, as Postgres enforces it: ON CONFLICT DO NOTHING. */
function fakeDb(): SubmitTokenDb & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    submitToken: {
      async createMany({ data }) {
        let count = 0;
        for (const r of data) if (!rows.has(r.id)) { rows.set(r.id, r.action); count++; }
        return { count };
      },
    },
  };
}
const form = (token?: string) => {
  const fd = new FormData();
  if (token !== undefined) fd.set(SUBMIT_TOKEN_FIELD, token);
  return fd;
};
const T = "0b3f8a52-6c1e-4b7a-9d2f-8e4c1a7b5d30";

describe("claimSubmitToken", () => {
  it("accepts a token once and refuses the same token after — the double press", async () => {
    const db = fakeDb();
    expect(await claimSubmitToken(db, form(T), "t1", "walkIn")).toBe(true);
    expect(await claimSubmitToken(db, form(T), "t1", "walkIn")).toBe(false);
  });

  it("treats case as the same token — a retried request is not a new one", async () => {
    const db = fakeDb();
    await claimSubmitToken(db, form(T), "t1", "walkIn");
    expect(await claimSubmitToken(db, form(T.toUpperCase()), "t1", "walkIn")).toBe(false);
  });

  it("lets a form without a token through, and records nothing — an old page must keep working", async () => {
    const db = fakeDb();
    expect(await claimSubmitToken(db, form(), "t1", "walkIn")).toBe(true);
    expect(await claimSubmitToken(db, form("not-a-token"), "t1", "walkIn")).toBe(true);
    expect(db.rows.size).toBe(0);
  });

  it("a new token is a new submission — the same form used twice on purpose", async () => {
    const db = fakeDb();
    expect(await claimSubmitToken(db, form(T), "t1", "postCharge")).toBe(true);
    expect(await claimSubmitToken(db, form("7a1c2e44-0d9b-4f6a-8c3e-2b5d9f1e6a07"), "t1", "postCharge")).toBe(true);
  });
});
