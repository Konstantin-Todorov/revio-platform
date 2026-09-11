import { describe, it, expect } from "vitest";
import { canSelfStartTrial, selfTrialPromises, type SelfTrialFacts } from "./self-serve.js";
import { TRIAL_DAYS } from "./trials.js";

/**
 * The rules that let a hotel start its own trial without anything beginning by accident.
 *
 * This reverses a decision that was written down and argued for, so the conditions replacing it are
 * asserted rather than assumed — each test below is a way the button could cost real money or take a
 * product away from somebody who pays for it.
 */

const CUSTOMER: SelfTrialFacts = {
  product: "pms",
  owns: { cm: true, crs: false, pms: false },
  everTrialled: [],
  tenantStatus: "active",
  role: "owner",
};

describe("who may start one", () => {
  it("lets an owner of a paying account start a product they do not have", () => {
    expect(canSelfStartTrial(CUSTOMER).ok).toBe(true);
  });

  it("lets an admin do it too", () => {
    expect(canSelfStartTrial({ ...CUSTOMER, role: "admin" }).ok).toBe(true);
  });

  it("refuses everybody else, and says who to ask", () => {
    /*
     * A trial becomes a bill if they keep it, so the person starting it has to be the person who
     * could agree to that. Reception cannot commit the account.
     */
    for (const role of ["reception", "manager", "housekeeper", "read_only", ""]) {
      const v = canSelfStartTrial({ ...CUSTOMER, role });
      expect(v.ok, role).toBe(false);
      expect(v.reason).toBe("not_permitted");
      expect(v.message, role).toMatch(/owner|admin/i);
    }
  });
});

describe("what it refuses, and why each would cost something", () => {
  /*
   * THE loophole, and the one that is easiest to miss. The database's partial unique index only
   * prevents two trials RUNNING at once — correct for an operator granting a second look by hand.
   * As the only rule for self-serve it is a loop: trial, let it lapse, start another, forever. Free
   * indefinitely, arrived at honestly, one month at a time.
   */
  it("refuses a SECOND trial of a product ever trialled, not merely one running now", () => {
    const v = canSelfStartTrial({ ...CUSTOMER, everTrialled: ["pms"] });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("already_trialled");
    // And it still offers a way forward rather than only a refusal.
    expect(v.message).toMatch(/reply to any Revio email/i);
  });

  it("does not mind that a DIFFERENT product was trialled", () => {
    expect(canSelfStartTrial({ ...CUSTOMER, everTrialled: ["crs"] }).ok).toBe(true);
  });

  it("refuses a product they already own — the most damaging thing this button could do", () => {
    // A trial of something they pay for would take it away on the day it ended.
    const v = canSelfStartTrial({ ...CUSTOMER, owns: { cm: true, crs: false, pms: true } });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("already_owned");
    expect(v.message).toMatch(/take it away/i);
  });

  it("refuses a suspended account", () => {
    for (const status of ["suspended", "cancelled", ""]) {
      expect(canSelfStartTrial({ ...CUSTOMER, tenantStatus: status }).ok, status).toBe(false);
    }
  });

  it("refuses somebody who owns nothing — this is expansion, not a way in", () => {
    /*
     * The whole pitch is that the trial runs on data they already keep here. A tenant with no
     * product has none, so there is nothing to evaluate and the trial would be an empty shell.
     */
    const v = canSelfStartTrial({ ...CUSTOMER, owns: { cm: false, crs: false, pms: false } });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("not_a_customer");
    expect(v.message).toMatch(/demo/i);
  });

  it("checks permission before anything else, so a refusal never leaks account state", () => {
    // A receptionist asking about a suspended account learns they are not permitted — not that the
    // account is suspended, nor which products it holds.
    const v = canSelfStartTrial({ ...CUSTOMER, role: "reception", tenantStatus: "suspended", everTrialled: ["pms"] });
    expect(v.reason).toBe("not_permitted");
  });
});

describe("what the hotel is promised", () => {
  it("says it switches off by itself and charges nothing", () => {
    // These are the two fears that stop people starting a trial, and both are true here.
    const promises = selfTrialPromises("pms", TRIAL_DAYS).join(" ");
    expect(promises).toMatch(/Nothing is charged/i);
    expect(promises).toMatch(/no card/i);
    expect(promises).toMatch(/simply switches off/i);
    expect(promises).toMatch(/nothing starts charging on its own/i);
  });

  it("names the product and the length", () => {
    expect(selfTrialPromises("crs", 30).join(" ")).toMatch(/RevioCRS switches on now, for 30 days/);
  });

  it("promises the warnings the sweep actually sends", () => {
    // A promise here that the sweep does not keep is worse than no promise — it is 7 and 1 days.
    expect(selfTrialPromises("pms", 30).join(" ")).toMatch(/a week before it ends, and again the day before/);
  });

  it("leads with what the platform's whole claim rests on", () => {
    expect(selfTrialPromises("pms", 30)[2]).toMatch(/nothing to import/i);
  });
});
