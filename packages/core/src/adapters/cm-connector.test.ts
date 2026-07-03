import { describe, expect, it } from "vitest";
import { createCmConnector, RevioLinkInternalConnector } from "./cm-connector.js";

describe("ChannelManagerConnector", () => {
  it("defaults to the RevioLink internal connector (null/empty/explicit)", () => {
    for (const kind of [null, undefined, "", "reviolink_internal"]) {
      expect(createCmConnector(kind)).toBeInstanceOf(RevioLinkInternalConnector);
    }
  });
  it("internal push is a no-op acknowledgement — shared DB, no network", async () => {
    const res = await createCmConnector(null).pushAvailability([
      { roomTypeCode: "DDR", date: "2026-07-10", bookable: 5 },
    ]);
    expect(res.ok).toBe(true);
    expect(res.transport).toBe("internal");
  });
  it("rejects unknown connectors loudly", () => {
    expect(() => createCmConnector("siteminder")).toThrow(/Unknown channel-manager connector/);
  });
});
