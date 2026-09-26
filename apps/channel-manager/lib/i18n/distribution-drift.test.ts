import { describe, expect, it } from "vitest";
import { channelJourney, describeCrossWire, type JourneyFacts } from "@revio/core";
import { describeCatchup, summarisePublished, type CatchupResult, type PublishedComparison } from "@revio/connectivity";
import { channels } from "./channels";
import { mapping } from "./mapping";
import { channelErrors } from "./channel-errors";

/**
 * Sentences core and connectivity write in English that RevioLink now words itself — the channel
 * journey, a cross-wired mapping, Verify's headline and the send-one-product result. The Operator
 * console and the audit log still read the originals, so the English here must stay word for word.
 */
describe("distribution sentences match core, in English", () => {
  it("every step of the channel journey, and each one as the next step", () => {
    const j = channels.en.journey;
    const base: JourneyFacts = {
      channelName: "Booking.com", onChannex: true, mappingRows: 10, mappingComplete: 10,
      status: "connected", verifiedAt: new Date(), bookingsReceived: 1, mappingHref: "/mapping?ch=booking",
    };
    const cases: Partial<JourneyFacts>[] = [
      { onChannex: false }, { mappingComplete: 7 }, { status: "pending" }, { verifiedAt: null }, { bookingsReceived: 0 }, {},
    ];
    for (const c of cases) {
      const f = { ...base, ...c };
      for (const st of channelJourney(f)) {
        expect(j.labels[st.key](f.channelName)).toBe(st.label);
        if (st.next !== undefined) {
          const worded = st.key === "mapped" ? j.next.mapped(f.mappingRows - f.mappingComplete, f.mappingRows, f.channelName)
            : st.key === "on_channex" ? j.next.on_channex
            : j.next[st.key](f.channelName);
          expect(worded).toBe(st.next);
        }
        if (st.action) expect(st.key === "verified" ? j.actions.verified : j.actions.mapped).toBe(st.action.label);
      }
    }
  });

  it("a cross-wired rate plan, both reasons", () => {
    const w = mapping.en.crossWire;
    const base = { roomTypeName: "1 Bedroom", ratePlanName: "BB Flex", externalRateId: "0ea321e7" };
    expect(w.wrongRoom(base.roomTypeName, base.ratePlanName, "2 Bedroom")).toBe(describeCrossWire({ ...base, belongsToRoomName: "2 Bedroom", reason: "wrong_room" }));
    expect(w.wrongRoom(base.roomTypeName, base.ratePlanName, null)).toBe(describeCrossWire({ ...base, belongsToRoomName: null, reason: "wrong_room" }));
    expect(w.gone(base.roomTypeName, base.ratePlanName, base.externalRateId)).toBe(describeCrossWire({ ...base, belongsToRoomName: null, reason: "not_in_catalogue" }));
  });

  it("Verify's price headline", () => {
    const v = channelErrors.en.verify.prices;
    const row = (kind: PublishedComparison["kind"]): PublishedComparison => ({ kind, externalRateId: "x", date: "2026-10-01", ours: 100, theirs: 100 });
    expect(v.nothing).toBe(summarisePublished([]).headline);
    expect(v.exact(2)).toBe(summarisePublished([row("match"), row("match")]).headline);
    const mixed = summarisePublished([row("mismatch"), row("missing"), row("missing"), row("unexpected")]);
    expect([v.mismatched(1), v.missing(2), v.unexpected(1)].join(" · ")).toBe(mixed.headline);
  });

  it("the send-one-product result", () => {
    const c = channelErrors.en.catchup;
    const r = (adopted: boolean[], skipped: CatchupResult["skipped"] = []) =>
      ({ steps: adopted.map((a) => ({ adopted: a })), skipped }) as unknown as CatchupResult;
    expect(c.nothing).toBe(describeCatchup(r([])));
    expect(`${c.sent(1)}.`).toBe(describeCatchup(r([false])));
    expect(`${c.adopted(2)}.`).toBe(describeCatchup(r([true, true])));
    expect(`${[c.sent(1), c.adopted(1), c.skipped(1, "Suite: derived")].join(" · ")}.`)
      .toBe(describeCatchup(r([false, true], [{ name: "Suite", why: "derived" }])));
  });
});
