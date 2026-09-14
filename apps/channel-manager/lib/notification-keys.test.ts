import { describe, it, expect } from "vitest";
import { MAX_READ_KEYS, isNotificationKey, pruneReadKeys } from "./notification-keys";

describe("isNotificationKey", () => {
  it("accepts the keys the feed actually produces", () => {
    for (const k of ["reservation:cmsgatqho0002u8shlwvhlwtc", "sync:abc123", "error:x_1-2"]) {
      expect(isNotificationKey(k)).toBe(true);
    }
  });

  it("⚠️ refuses anything else — this string is appended to a column on the accounts table", () => {
    /*
     * `markNotificationRead` is a POST endpoint. Without this, each call writes whatever was sent
     * into `User.notificationsReadKeys` — a quiet way to fill a database one request at a time.
     */
    for (const k of [
      "", "no-colon", "a".repeat(300), "reservation:" + "x".repeat(80),
      "Reservation:abc", "../../etc/passwd", "sync:abc def", "sync:<script>",
      null, undefined, 42, {},
    ]) {
      expect(isNotificationKey(k)).toBe(false);
    }
  });
});

describe("pruneReadKeys", () => {
  it("keeps the newest and drops the oldest", () => {
    const many = Array.from({ length: MAX_READ_KEYS + 50 }, (_, i) => `sync:k${i}`);
    const kept = pruneReadKeys(many);
    expect(kept).toHaveLength(MAX_READ_KEYS);
    expect(kept.at(-1)).toBe(`sync:k${MAX_READ_KEYS + 49}`);
    expect(kept).not.toContain("sync:k0");
  });

  it("leaves a short list alone", () => {
    expect(pruneReadKeys(["sync:a", "sync:b"])).toEqual(["sync:a", "sync:b"]);
  });
});
