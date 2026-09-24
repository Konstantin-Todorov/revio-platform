import { describe, expect, it } from "vitest";
import {
  FIELD_LABEL, PRODUCTS, TRIAL_DAYS, UPSELL_REASON, canSelfStartTrial, productAccessCopy, productAccessState,
  selfTrialPromises, validateBillingIdentity, type BillingIdentity, type ProductKey,
} from "@revio/core";
import { fill } from "@revio/ui/i18n";
import { productStrings } from "@revio/ui/product-strings";
import { billingStrings } from "@revio/ui/billing-strings";
import { authRefusalStrings } from "@revio/ui/auth-strings";
import { PASSWORD_MIN_LENGTH, checkToken, validatePassword, type TokenPurpose } from "@revio/core";
import { breachMessage } from "@revio/core/server";

/**
 * The sentences about products, trials and company details are written twice: in `@revio/core`,
 * where the tests hold them as the contract, and in `@revio/ui`'s strings, which say them in the
 * reader's language. English must be the same sentence in both, or an English screen changes the
 * day somebody edits one copy. Same rule as `welcome-drift.test.ts`.
 */
const en = productStrings.en;
const KEYS: ProductKey[] = ["cm", "crs", "pms"];

describe("product words match core, in English", () => {
  it("taglines", () => {
    for (const p of PRODUCTS) expect(en.tagline[p.key]).toBe(p.tagline);
  });

  it("upsell reasons", () => {
    expect(en.upsell).toEqual(UPSELL_REASON);
  });

  it("the locked screen, for every reason", () => {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const ENDED = new Date("2026-09-01T00:00:00Z");
    const all = { cm: false, crs: false, pms: false };
    const cases = [
      { trials: [{ product: "pms" as const, endedAt: ENDED, outcome: "expired", keepRequestedAt: null }] },
      { trials: [{ product: "pms" as const, endedAt: ENDED, outcome: "cancelled", keepRequestedAt: null }] },
      { trials: [] },
    ];
    for (const c of cases) {
      const state = productAccessState({ product: "pms", trials: c.trials, entitlements: all });
      const core = productAccessCopy(state, "Hotel Sofia", fmt);
      const vars = {
        product: state.product.name, hotel: "Hotel Sofia", ended: state.endedAt ? fmt(state.endedAt) : en.locked.endDateFallback,
        tagline: en.tagline.pms, days: TRIAL_DAYS,
      };
      const [title, body] =
        state.reason === "trial-ended"
          ? [en.locked.trialEndedTitle, en.locked.trialEndedBody]
          : state.reason === "switched-off"
            ? [en.locked.switchedOffTitle, en.locked.switchedOffBody]
            : [en.locked.neverHadTitle, en.locked.neverHadBody];
      expect({ title: fill(title, vars), body: fill(body, vars) }).toEqual(core);
    }
  });

  it("the trial promises, for every product", () => {
    for (const k of KEYS) {
      const name = PRODUCTS.find((p) => p.key === k)!.name;
      const p = en.trial.promises;
      const ours = [p.on, p.noCharge, p.noImport, TRIAL_DAYS > 7 ? p.reminderWeek : p.reminderFew, p.noAuto, p.payFromDecide, p.separate]
        .map((l) => fill(l, { product: name, days: TRIAL_DAYS }));
      expect(ours).toEqual(selfTrialPromises(k, TRIAL_DAYS));
    }
  });

  it("every trial refusal", () => {
    const owns = { cm: true, crs: false, pms: false };
    const base = { product: "pms" as ProductKey, owns, everTrialled: [] as ProductKey[], tenantStatus: "active", role: "owner" };
    const cases = [
      { ...base, role: "reception" },
      { ...base, tenantStatus: "suspended" },
      { ...base, owns: { ...owns, pms: true } },
      { ...base, owns: { cm: false, crs: false, pms: false } },
      { ...base, everTrialled: ["pms" as ProductKey] },
    ];
    const seen = new Set<string>();
    for (const c of cases) {
      const v = canSelfStartTrial(c);
      expect(v.ok).toBe(false);
      seen.add(v.reason!);
      expect(fill(en.trial.refusal[v.reason!], { product: "RevioPMS" })).toBe(v.message);
    }
    expect([...seen].sort()).toEqual(Object.keys(en.trial.refusal).sort());
  });
});

describe("company-details words match core, in English", () => {
  it("field labels", () => {
    expect(billingStrings.en.form.fields).toEqual(FIELD_LABEL);
  });

  it("every problem", () => {
    const blank: BillingIdentity = {
      legalName: "", country: "", companyId: "", vatId: "", addressLine: "", city: "", postCode: "", billingEmail: "", attention: "",
    };
    const bad: BillingIdentity = { ...blank, legalName: "X", addressLine: "X", city: "X", country: "BG", vatId: "123", billingEmail: "nope" };
    const problems = [
      ...validateBillingIdentity(blank),
      ...validateBillingIdentity(bad),
      ...validateBillingIdentity({ ...bad, country: "Bulgaria", vatId: "" }),
    ];
    const seen = new Set<string>();
    for (const p of problems) {
      seen.add(p.code);
      expect(fill(billingStrings.en.form.problems[p.code], { country: "BG", prefix: "BG" })).toBe(p.message);
    }
    expect([...seen].sort()).toEqual(Object.keys(billingStrings.en.form.problems).sort());
  });
});

describe("link and password refusals match core, in English", () => {
  const en = authRefusalStrings.en;
  const say = (code: keyof typeof en, n: string | number = "") => fill(en[code], { n });

  it("every password rule", () => {
    const tries = ["short", "x".repeat(201), "revio1234xyz", "aaaaaaaaaaaa", "abcdefghijkl", "poiuytrewq", "hotel2026", "mariapetrova99"];
    const seen = new Set<string>();
    for (const pw of tries) {
      const r = validatePassword(pw, { email: "mariapetrova@hotel.test" });
      if (r.ok) continue;
      seen.add(r.code);
      expect(say(r.code, PASSWORD_MIN_LENGTH)).toBe(r.message);
    }
    expect([...seen].sort()).toEqual(
      ["password.email", "password.keyRow", "password.obvious", "password.repeated", "password.sequence", "password.tooLong", "password.tooShort"],
    );
    expect(say("password.breached")).toBe(breachMessage(1));
    expect(say("password.breachedMany", "1,234")).toBe(breachMessage(1234));
  });

  it("used and expired links, for every kind", () => {
    for (const purpose of ["invite", "reset", "handoff:pms"] as TokenPurpose[]) {
      for (const record of [{ purpose, expiresAt: 0, usedAt: 1 }, { purpose, expiresAt: 0, usedAt: null }]) {
        const r = checkToken(record, 10);
        if (r.usable) throw new Error("should be refused");
        expect(say(r.code)).toBe(r.message);
      }
    }
  });
});
