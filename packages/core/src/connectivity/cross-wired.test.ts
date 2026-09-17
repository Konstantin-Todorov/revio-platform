import { describe, expect, it } from "vitest";

import { crossWiredRatePlans, describeCrossWire } from "./cross-wired";

// The real shape, from Cabacum Beach Residence on 2026-09-17.
const CATALOGUE = [
  { id: "0ea321e7", title: "BB BAR - BookingCom", externalRoomId: "d383225c" }, // 1 Bedroom
  { id: "749e0e4c", title: "BB BAR - BookingCom", externalRoomId: "5b6c86e1" }, // 2 Bedrooms
  { id: "cb75de7d", title: "BB BAR", externalRoomId: "5b6c86e1" },              // 2 Bedrooms
];
const OUR_ROOMS = new Map([
  ["rt1", "d383225c"], // Apartment, 1 Bedroom
  ["rt2", "5b6c86e1"], // Apartment, 2 Bedrooms
]);
const CHANNEL_ROOM_NAMES = new Map([
  ["d383225c", "Apartment, 1 Bedroom"],
  ["5b6c86e1", "Apartment, 2 Bedrooms"],
]);

describe("crossWiredRatePlans", () => {
  it("says nothing when every plan belongs to the room it is mapped under", () => {
    const rows = [{ roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "BB Flex", externalRateId: "cb75de7d" }];
    expect(crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS)).toEqual([]);
  });

  it("⚠️ catches the production fault: one room's prices published against another", () => {
    // Revio had `Apartment, 2 Bedrooms → Standard Rate → 0ea321e7`, and Channex says 0ea321e7
    // belongs to Apartment, 1 Bedroom. Everything looked finished: mapped, green, pushes succeeding.
    const rows = [{ roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "0ea321e7" }];
    const [fault] = crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS, CHANNEL_ROOM_NAMES);
    expect(fault?.reason).toBe("wrong_room");
    expect(fault?.belongsToRoomName).toBe("Apartment, 1 Bedroom");
    expect(describeCrossWire(fault!)).toMatch(/going onto the wrong room/);
  });

  it("⚠️ a collision check could not have found it — the id is used exactly once", () => {
    const rows = [
      { roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "0ea321e7" },
      { roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "BB Flex", externalRateId: "cb75de7d" },
    ];
    const ids = rows.map((r) => r.externalRateId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates anywhere
    expect(crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS)).toHaveLength(1);
  });

  it("flags an id the channel no longer has", () => {
    const rows = [{ roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Old", externalRateId: "deleted-plan" }];
    const [fault] = crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS);
    expect(fault?.reason).toBe("not_in_catalogue");
    expect(describeCrossWire(fault!)).toMatch(/no longer has/);
  });

  it("skips a row whose ROOM TYPE is not mapped — one cause must not report two faults", () => {
    const rows = [{ roomTypeId: "rt_unmapped", roomTypeName: "Apartment, 3 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "0ea321e7" }];
    expect(crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS)).toEqual([]);
  });

  it("ignores rows with no external id — unmapped is a different fault the screen already shows", () => {
    const rows = [{ roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "" }];
    expect(crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS)).toEqual([]);
  });

  it("names the room even when the channel room name is unknown", () => {
    const rows = [{ roomTypeId: "rt2", roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "0ea321e7" }];
    const [fault] = crossWiredRatePlans(rows, CATALOGUE, OUR_ROOMS); // no name map
    expect(fault?.belongsToRoomName).toBeNull();
    expect(describeCrossWire(fault!)).toMatch(/another room/);
  });
});

describe("a channel that does not scope plans by room", () => {
  /*
   * The mock adapter answers null for every plan's room. Judging against that would print a
   * cross-wire banner on both demo hotels, every day, for mappings that are correct.
   */
  const UNSCOPED = CATALOGUE.map((c) => ({ ...c, externalRoomId: null }));

  it("accuses nothing when the channel never said which room a plan belongs to", () => {
    // rt1 is the 1-Bedroom and 749e0e4c is the 2-Bedroom's plan: cross-wired if the channel had said.
    const rows = [{ roomTypeId: "rt1", roomTypeName: "Apartment, 1 Bedroom", ratePlanName: "Standard Rate", externalRateId: "749e0e4c" }];
    expect(crossWiredRatePlans(rows, UNSCOPED, OUR_ROOMS)).toEqual([]);
  });

  it("still reports an id the channel does not have at all", () => {
    const rows = [{ roomTypeId: "rt1", roomTypeName: "Apartment, 1 Bedroom", ratePlanName: "Standard Rate", externalRateId: "gone" }];
    expect(crossWiredRatePlans(rows, UNSCOPED, OUR_ROOMS)[0]?.reason).toBe("not_in_catalogue");
  });
});
