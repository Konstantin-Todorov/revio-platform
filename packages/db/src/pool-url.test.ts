import { describe, expect, it } from "vitest";
import { poolSize, withPoolLimit } from "./pool-url";

describe("withPoolLimit", () => {
  it("adds a cap to a bare URL", () => {
    expect(withPoolLimit("postgresql://u:p@h:5432/db", 5)).toBe("postgresql://u:p@h:5432/db?connection_limit=5&pool_timeout=20");
  });
  it("appends to a URL that already has parameters", () => {
    expect(withPoolLimit("postgresql://u:p@h/db?sslmode=require", 5)).toBe("postgresql://u:p@h/db?sslmode=require&connection_limit=5&pool_timeout=20");
  });
  it("leaves an explicit connection_limit alone", () => {
    expect(withPoolLimit("postgresql://h/db?connection_limit=12", 5)).toBe("postgresql://h/db?connection_limit=12");
  });
  it("passes an absent URL through", () => {
    expect(withPoolLimit(undefined, 5)).toBeUndefined();
  });
});

describe("poolSize", () => {
  it("defaults to five and honours DB_POOL_SIZE", () => {
    expect(poolSize({})).toBe(5);
    expect(poolSize({ DB_POOL_SIZE: "8" })).toBe(8);
    expect(poolSize({ DB_POOL_SIZE: "nope" })).toBe(5);
  });
});
