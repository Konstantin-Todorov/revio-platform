import { describe, it, expect } from "vitest";
describe("temporary promote-gate probe", () => {
  it("fails on purpose to prove a red CI does not reach production", () => {
    expect("this build must not be promoted").toBe("promoted");
  });
});
