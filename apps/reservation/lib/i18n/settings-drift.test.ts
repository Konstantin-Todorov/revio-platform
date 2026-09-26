import { describe, expect, it } from "vitest";
import { describeSwitch, type SwitchPlan } from "@revio/core";
import { settings } from "./settings";
import { ROLE_OPTIONS } from "@/components/settings/StaffManagement";

/**
 * The pricing-model preview is worded in RevioCRS from the same facts core's `describeSwitch` reads.
 * The English must stay what core says, in every branch.
 */
describe("Settings English matches core", () => {
  const w = settings.en.switch;
  const result = (changed: boolean, before: number, after: number, skipped?: string) =>
    ({ ratePlanId: "x", planName: "P", changed, before, after, options: [], primaryOccupancy: 2, ...(skipped ? { skipped } : {}) });
  const plan = (results: ReturnType<typeof result>[]): SwitchPlan =>
    ({ results, changedCount: results.filter((r) => r.changed).length, noop: results.every((r) => !r.changed) }) as unknown as SwitchPlan;

  for (const target of ["per_person", "per_room"] as const) {
    const pp = target === "per_person";
    it(`${target}: nothing to do`, () => expect(w.noop(pp)).toBe(describeSwitch(plan([result(false, 1, 1, "Already in this shape.")]), target)));
    it(`${target}: one plan, none skipped`, () => {
      const p = plan([result(true, 1, 3)]);
      expect(w.head(pp, 1, 2) + w.safety(pp)).toBe(describeSwitch(p, target));
    });
    it(`${target}: two plans, one set on its own`, () => {
      const p = plan([result(true, 1, 2), result(true, 1, 3), result(false, 1, 1, "Set to per room on its own — a property change does not override that.")]);
      expect(w.head(pp, 2, 3) + w.safety(pp) + w.skipped(1)).toBe(describeSwitch(p, target));
    });
  }

  it("role names are the staff screen's English", () => {
    for (const [key, label] of ROLE_OPTIONS) expect(settings.en.staff.roles[key as keyof typeof settings.en.staff.roles]).toBe(label);
  });
});
