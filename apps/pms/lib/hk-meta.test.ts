import { describe, expect, it } from "vitest";
import { HK_STATUSES, settableStatuses } from "./hk-meta";

describe("who may set which housekeeping status", () => {
  it("a housekeeper moves a room through their own work, and nothing else", () => {
    expect(settableStatuses("housekeeper")).toEqual(["dirty", "in_progress", "clean"]);
    // The inspection gate and the off-sale decision are the supervisor's (PMS-GUIDE §3.4).
    expect(settableStatuses("housekeeper")).not.toContain("inspected");
    expect(settableStatuses("housekeeper")).not.toContain("out_of_order");
  });
  it.each(["hk_supervisor", "manager", "owner", "admin", "reception"])("%s keeps every status", (role) => {
    expect(settableStatuses(role)).toEqual(HK_STATUSES);
  });
});
