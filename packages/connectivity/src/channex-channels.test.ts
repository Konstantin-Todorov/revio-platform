import { describe, it, expect } from "vitest";
import { parseAdapter, visibleFields, visibleFieldsFor, defaultSettings, missingRequired, CHANNEL_CODES } from "./channex-channels.js";

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

/*
 * Conditional field rules — added 2026-08-26, after building the form found that ignoring them made
 * it ask for a Property Email that Channex itself would have hidden.
 *
 * Both descriptors below are the LIVE responses, recorded from the API.
 */
describe("conditional visibility (FieldRule)", () => {
  // The rule Booking.com and Expedia both carry, verbatim from the API.
  const withRule = {
    data: {
      code: "BookingCom",
      title: "Booking.com",
      params: {
        hotel_id: { position: 0, type: "string", title: "Hotel ID" },
        machine_account: { position: 1, type: "hidden", title: "Machine Account" },
        send_email_notifications: { default: false, position: 2, type: "boolean", title: "Send Property Notification" },
        email: {
          position: 3,
          type: "string",
          title: "Property Email",
          rules: [{ apply: "hidden", when: false, influence_field: "send_email_notifications", with_value: "" }],
        },
      },
    },
  };

  it("parses the rule rather than passing it through as unknown", () => {
    const d = parseAdapter(withRule)!;
    const email = d.fields.find((f) => f.name === "email")!;
    expect(email.rules).toEqual([{ apply: "hidden", when: false, influenceField: "send_email_notifications" }]);
  });

  it("hides Property Email while notifications are off", () => {
    const d = parseAdapter(withRule)!;
    const names = visibleFieldsFor(d, { send_email_notifications: false }).map((f) => f.name);
    expect(names).toEqual(["hotel_id", "send_email_notifications"]);
  });

  it("shows it once notifications are on", () => {
    const d = parseAdapter(withRule)!;
    const names = visibleFieldsFor(d, { send_email_notifications: true }).map((f) => f.name);
    expect(names).toEqual(["hotel_id", "send_email_notifications", "email"]);
  });

  it("treats the form's string 'false' the same as the descriptor's boolean false", () => {
    // A checkbox comes back from a FormData as a string. Both mean the same thing to Channex.
    const d = parseAdapter(withRule)!;
    expect(visibleFieldsFor(d, { send_email_notifications: "false" }).map((f) => f.name)).not.toContain("email");
  });

  it("does not demand a hidden field — the bug this fixes", () => {
    const d = parseAdapter(withRule)!;
    // Notifications off, Hotel ID given: nothing outstanding. Before the fix this asked for an email.
    expect(missingRequired(d, { hotel_id: "88291", send_email_notifications: false })).toEqual([]);
  });

  it("does demand it once the hotel asks for notifications", () => {
    const d = parseAdapter(withRule)!;
    expect(missingRequired(d, { hotel_id: "88291", send_email_notifications: true })).toEqual(["Property Email"]);
  });

  it("still demands the Hotel ID", () => {
    const d = parseAdapter(withRule)!;
    expect(missingRequired(d, { send_email_notifications: false })).toEqual(["Hotel ID"]);
  });

  it("a field with no rules is always visible", () => {
    const d = parseAdapter(withRule)!;
    expect(visibleFieldsFor(d, {}).map((f) => f.name)).toContain("hotel_id");
  });
});
