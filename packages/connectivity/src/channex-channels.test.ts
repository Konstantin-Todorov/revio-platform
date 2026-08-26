import { describe, it, expect } from "vitest";
import { parseAdapter, visibleFields, defaultSettings, missingRequired, CHANNEL_CODES } from "./channex-channels.js";

/**
 * Built against the REAL responses, recorded from the live API on 2026-08-26. The shape is Channex's
 * and we do not control it, so pinning it against a real body is the only test worth having — an
 * invented fixture would only prove the parser agrees with my guess.
 */

const BOOKING = {
  data: {
    code: "BookingCom",
    title: "Booking.com",
    params: {
      hotel_id: { position: 0, type: "string", title: "Hotel ID" },
      machine_account: { position: 1, type: "hidden", title: "Machine Account ID" },
      send_email_notifications: { default: false, position: 2, type: "boolean", title: "Send Property Notification" },
      email: { position: 3, type: "string", title: "Property Email", rules: [{ apply: "hidden", when: false }] },
      allow_payout_update: { position: 5, type: "hidden", title: "Allow Payout Updates" },
    },
  },
};

const EXPEDIA = {
  data: {
    code: "Expedia",
    title: "Expedia",
    params: {
      hotel_id: { position: 0, type: "string", title: "Hotel ID" },
      min_stay_type: { default: "Arrival", position: 1, type: "select", options: ["Arrival", "Through"], title: "Min Stay Type" },
      send_email_notifications: { default: false, position: 2, type: "boolean", title: "Send Property Notifications" },
    },
  },
};

describe("parseAdapter", () => {
  it("reads Booking.com's real descriptor", () => {
    const d = parseAdapter(BOOKING)!;
    expect(d.title).toBe("Booking.com");
    expect(d.fields.map((f) => f.name)).toContain("hotel_id");
  });

  it("keeps Channex's own field order", () => {
    // The form should read the way they designed it — Hotel ID first, not alphabetically.
    const d = parseAdapter(BOOKING)!;
    expect(d.fields[0]!.name).toBe("hotel_id");
    expect(d.fields.map((f) => f.position)).toEqual([...d.fields.map((f) => f.position)].sort((a, b) => a - b));
  });

  it("carries select options through", () => {
    const d = parseAdapter(EXPEDIA)!;
    const sel = d.fields.find((f) => f.name === "min_stay_type")!;
    expect(sel.type).toBe("select");
    expect(sel.options).toEqual(["Arrival", "Through"]);
    expect(sel.default).toBe("Arrival");
  });

  it("returns null rather than an empty form when the response is not a descriptor", () => {
    // `code=booking` returns a 500 body. A form rendered from that would be a blank screen with a
    // Save button, which is worse than an error.
    expect(parseAdapter({ errors: { code: "internal_server_error" } })).toBeNull();
    expect(parseAdapter(null)).toBeNull();
  });
});

describe("visibleFields", () => {
  it("hides Channex's plumbing from the hotelier", () => {
    /*
     * "Machine Account ID" and "Allow Payout Updates" are Channex internals. Putting them on a
     * hotelier's screen asks a question they cannot answer and invites a wrong answer.
     */
    const names = visibleFields(parseAdapter(BOOKING)!).map((f) => f.name);
    expect(names).not.toContain("machine_account");
    expect(names).not.toContain("allow_payout_update");
    expect(names).toContain("hotel_id");
  });

  it("leaves Booking.com asking for one thing", () => {
    // The headline finding: connecting Booking.com needs the hotel's Hotel ID and nothing else.
    const required = missingRequired(parseAdapter(BOOKING)!, {});
    expect(required).toEqual(["Hotel ID", "Property Email"]);
  });
});

describe("defaultSettings", () => {
  it("includes hidden defaults, which still have to be sent", () => {
    expect(defaultSettings(parseAdapter(EXPEDIA)!)).toEqual({ min_stay_type: "Arrival", send_email_notifications: false });
  });
});

describe("missingRequired", () => {
  it("reports a blank Hotel ID before we ask Channex", () => {
    expect(missingRequired(parseAdapter(EXPEDIA)!, {})).toContain("Hotel ID");
  });

  it("treats whitespace as blank", () => {
    expect(missingRequired(parseAdapter(EXPEDIA)!, { hotel_id: "   " })).toContain("Hotel ID");
  });

  it("is satisfied by a real value", () => {
    expect(missingRequired(parseAdapter(EXPEDIA)!, { hotel_id: "12345" })).toEqual([]);
  });

  it("does not demand a value for a boolean or a select — they always have one", () => {
    const d = parseAdapter(EXPEDIA)!;
    expect(missingRequired(d, { hotel_id: "1" })).toEqual([]);
  });
});

describe("CHANNEL_CODES", () => {
  it("uses the exact casing the API accepts", () => {
    // Verified live: "booking" and "Booking" both return a 500; "BookingCom" works. Written down
    // because it is not guessable and the failure is an opaque server error.
    expect(CHANNEL_CODES.find((c) => c.name === "Booking.com")!.code).toBe("BookingCom");
  });
});
