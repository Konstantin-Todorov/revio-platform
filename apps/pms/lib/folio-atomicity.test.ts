import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ⚠️ Does `ensureFolio` open a transaction at all?
 *
 * `folio-atomic-verify` (in `packages/db`) proves the guarantee on the real table: a throw inside
 * `withTenantTransaction` leaves no Folio row. It cannot prove that THIS function is inside one —
 * and that is the half that was wrong. Eight of nine call sites ran the seed as a run of separate
 * commits, so a failure partway left a bill missing the room charge, the city tax, or the
 * prepaid-OTA payment that says the guest has already paid.
 *
 * Together the two are the whole claim: the mechanism contains failures, and this function uses it.
 */

const control = vi.hoisted(() => ({ opened: 0, lockSql: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("./data", () => ({ activeProperty: vi.fn() }));
vi.mock("./db", () => ({ prisma: new Proxy({}, { get() { throw new Error("ensureFolio used the NON-transactional client"); } }) }));

/** A transaction client that records the lock and then refuses to seed, standing in for a mid-seed crash. */
const fakeTx = {
  $executeRaw: (strings: TemplateStringsArray, ...v: unknown[]) => {
    control.lockSql.push(strings.join("?") + JSON.stringify(v));
    return Promise.resolve(1);
  },
  folio: { findFirst: async () => null },
  reservation: { findFirst: async () => { throw new Error("injected failure, mid-seed"); } },
};

vi.mock("@revio/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@revio/db")>();
  return {
    ...original,
    withTenantTransaction: async (_tenant: string, fn: (tx: unknown) => Promise<unknown>) => {
      control.opened++;
      // The real one rolls back when the callback throws; here we only need the throw to escape,
      // because swallowing it is the one thing that would re-create the partial commit.
      return fn(fakeTx);
    },
  };
});

beforeEach(() => { control.opened = 0; control.lockSql = []; });

describe("ensureFolio", () => {
  it("⚠️ opens a transaction rather than writing through the request client", async () => {
    const { ensureFolio } = await import("./folio");
    // The mocked `./db` proxy throws on ANY access, so this passing at all proves the seed never
    // touched the non-transactional client.
    await expect(ensureFolio("t1", "p1", "r1")).rejects.toThrow("injected failure, mid-seed");
    expect(control.opened).toBe(1);
  });

  it("⚠️ takes an advisory lock on the reservation before deciding whether a folio exists", async () => {
    // Without it, two concurrent check-ins both read "no folio" and both create one — `Folio` has
    // no unique constraint on (reservationId, isPrimary), only an index — and the guest ends up
    // with two primary bills and their money split across them.
    const { ensureFolio } = await import("./folio");
    await expect(ensureFolio("t1", "p1", "r-lock-me")).rejects.toThrow();
    expect(control.lockSql.join(" ")).toMatch(/pg_advisory_xact_lock/);
    expect(control.lockSql.join(" ")).toContain("r-lock-me");
  });

  it("⚠️ lets the error escape — swallowing it would commit the half-built bill", async () => {
    // `packages/db`'s own rule: "Do not catch inside the callback and continue." Throwing is what
    // rolls the transaction back.
    const { ensureFolio } = await import("./folio");
    await expect(ensureFolio("t1", "p1", "r1")).rejects.toThrow();
  });

  it("joins a caller's transaction instead of nesting a second one", async () => {
    // The night audit is already inside `withTenantTransaction`; opening another would be refused
    // by Prisma, and the whole audit would fail on the first stay carrying an extra.
    const { ensureFolio } = await import("./folio");
    await expect(ensureFolio("t1", "p1", "r1", fakeTx as never)).rejects.toThrow("injected failure, mid-seed");
    expect(control.opened).toBe(0);
  });
});
