import { describe, it, expect } from "vitest";
import {
  EMPTY_READ_STATE, buildFeed, clearedAtFor, groupByDay, isRead, rankEvents, relativeTime,
  unreadCount, visibleEvents, type NotificationEvent,
} from "./feed.js";

const at = (iso: string) => new Date(iso);
const ev = (over: Partial<NotificationEvent> & Pick<NotificationEvent, "key" | "at">): NotificationEvent => ({
  title: over.key, href: "/dashboard", severity: "info", ...over,
});

describe("isRead", () => {
  const e = ev({ key: "reservation:1", at: at("2026-09-14T10:00:00Z") });

  it("is unread with no read state at all", () => {
    expect(isRead(e, EMPTY_READ_STATE)).toBe(false);
  });

  it("is read once its own key is marked", () => {
    expect(isRead(e, { clearedAt: null, readKeys: new Set(["reservation:1"]) })).toBe(true);
  });

  it("⚠️ 'mark all as read' includes an event created at that exact instant", () => {
    /*
     * `<` instead of `<=` here leaves the newest notification unread immediately after somebody
     * presses "mark all read" — which is the one they were looking at, and the one the button was
     * pressed for. Timestamps collide often enough for this to be the common case, not the edge.
     */
    expect(isRead(e, { clearedAt: at("2026-09-14T10:00:00Z"), readKeys: new Set() })).toBe(true);
  });

  it("leaves anything newer than the clear unread", () => {
    expect(isRead(e, { clearedAt: at("2026-09-14T09:59:59Z"), readKeys: new Set() })).toBe(false);
  });
});

describe("unreadCount", () => {
  it("counts only what this person has not seen", () => {
    const events = [
      ev({ key: "a", at: at("2026-09-14T08:00:00Z") }),
      ev({ key: "b", at: at("2026-09-14T09:00:00Z") }),
      ev({ key: "c", at: at("2026-09-14T10:00:00Z") }),
    ];
    expect(unreadCount(events, EMPTY_READ_STATE)).toBe(3);
    expect(unreadCount(events, { clearedAt: at("2026-09-14T09:00:00Z"), readKeys: new Set() })).toBe(1);
    expect(unreadCount(events, { clearedAt: at("2026-09-14T09:00:00Z"), readKeys: new Set(["c"]) })).toBe(0);
  });
});

describe("rankEvents", () => {
  it("newest first", () => {
    const out = rankEvents([
      ev({ key: "old", at: at("2026-09-13T10:00:00Z") }),
      ev({ key: "new", at: at("2026-09-14T10:00:00Z") }),
    ]);
    expect(out.map((e) => e.key)).toEqual(["new", "old"]);
  });

  it("⚠️ breaks a timestamp tie deterministically, so the panel does not reshuffle between polls", () => {
    // A job writes a run of rows inside one second. Without a tie-break the order depends on the
    // query planner, and the list silently rearranges every 60 seconds — which reads as new
    // activity when nothing has happened.
    const same = at("2026-09-14T10:00:00Z");
    const a = [ev({ key: "sync:b", at: same }), ev({ key: "sync:a", at: same })];
    expect(rankEvents(a).map((e) => e.key)).toEqual(["sync:a", "sync:b"]);
    expect(rankEvents([...a].reverse()).map((e) => e.key)).toEqual(["sync:a", "sync:b"]);
  });

  it("caps the feed", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      ev({ key: `k${i}`, at: at(`2026-09-14T10:00:0${i % 10}Z`) }));
    expect(rankEvents(many)).toHaveLength(50);
    expect(rankEvents(many, 5)).toHaveLength(5);
  });
});

describe("visibleEvents", () => {
  it("⚠️ drops what this role may not open — the line itself is the data", () => {
    // "Marcus Reyes checked out owing €140" tells a housekeeper a guest's name and the hotel's
    // money before she has clicked anything. Filtering the link would be too late.
    const events = [
      ev({ key: "folio:1", at: at("2026-09-14T10:00:00Z"), href: "/folios", title: "Marcus Reyes owes €140" }),
      ev({ key: "hk:1", at: at("2026-09-14T10:00:00Z"), href: "/housekeeping", title: "Room 214 is dirty" }),
    ];
    const housekeeperCanOpen = (href: string) => href === "/housekeeping";
    expect(visibleEvents(events, housekeeperCanOpen).map((e) => e.title)).toEqual(["Room 214 is dirty"]);
  });

  it("does not refuse everyone — a manager still sees the lot", () => {
    // A filter that denies indiscriminately passes every negative test and breaks the product.
    const events = [ev({ key: "a", at: at("2026-09-14T10:00:00Z") })];
    expect(visibleEvents(events, () => true)).toHaveLength(1);
  });
});

describe("groupByDay", () => {
  it("⚠️ uses the PROPERTY's calendar day, not the server's UTC one", () => {
    /*
     * 01:30 in Sofia on the 14th is 22:30 UTC on the 13th. The night auditor reading this panel at
     * 02:00 to see what came in overnight must be shown it under Today — UTC calls it yesterday
     * until 03:00, which is exactly that shift.
     */
    const overnight = ev({ key: "reservation:1", at: at("2026-09-13T22:30:00Z") });
    const now = at("2026-09-13T23:00:00Z"); // 02:00 on the 14th in Sofia
    const [group] = groupByDay([overnight], "Europe/Sofia", now);
    expect(group!.day).toBe("2026-09-14");
    expect(group!.label).toBe("Today");
    // The same instant, read from a UTC-keyed feed, would have landed under the previous day.
    expect(groupByDay([overnight], "UTC", now)[0]!.day).toBe("2026-09-13");
  });

  it("labels today, yesterday, then the date", () => {
    const now = at("2026-09-14T12:00:00Z");
    const days = groupByDay([
      ev({ key: "a", at: at("2026-09-14T10:00:00Z") }),
      ev({ key: "b", at: at("2026-09-13T10:00:00Z") }),
      ev({ key: "c", at: at("2026-09-10T10:00:00Z") }),
    ], "UTC", now);
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "2026-09-10"]);
  });

  it("keeps a run of one day together rather than heading each row", () => {
    const now = at("2026-09-14T12:00:00Z");
    const days = groupByDay([
      ev({ key: "a", at: at("2026-09-14T10:00:00Z") }),
      ev({ key: "b", at: at("2026-09-14T09:00:00Z") }),
    ], "UTC", now);
    expect(days).toHaveLength(1);
    expect(days[0]!.events).toHaveLength(2);
  });
});

describe("relativeTime", () => {
  const now = at("2026-09-14T12:00:00Z");
  it("reads the way somebody would say it", () => {
    expect(relativeTime(at("2026-09-14T11:59:30Z"), "UTC", now)).toBe("just now");
    expect(relativeTime(at("2026-09-14T11:58:00Z"), "UTC", now)).toBe("2 min ago");
    expect(relativeTime(at("2026-09-14T09:00:00Z"), "UTC", now)).toBe("3 h ago");
    expect(relativeTime(at("2026-09-12T12:00:00Z"), "UTC", now)).toBe("2 d ago");
  });

  it("hands back the date once 'days ago' stops being useful", () => {
    // "23 days ago" is a number somebody has to do arithmetic on to get what they wanted: the date.
    expect(relativeTime(at("2026-08-22T12:00:00Z"), "UTC", now)).toBe("2026-08-22");
  });

  it("never says a negative time for a clock that is slightly ahead", () => {
    expect(relativeTime(at("2026-09-14T12:00:05Z"), "UTC", now)).toBe("just now");
  });
});

describe("buildFeed", () => {
  const raw: NotificationEvent[] = [
    ev({ key: "folio:1", at: at("2026-09-14T11:00:00Z"), href: "/folios", title: "Marcus owes €140" }),
    ev({ key: "hk:1", at: at("2026-09-14T10:00:00Z"), href: "/housekeeping", title: "214 dirty" }),
    ev({ key: "hk:2", at: at("2026-09-14T09:00:00Z"), href: "/housekeeping", title: "215 dirty" }),
  ];
  const hk = (href: string) => href === "/housekeeping";

  it("scopes, ranks and marks in that order", () => {
    const feed = buildFeed(raw, [], EMPTY_READ_STATE, hk);
    expect(feed.events.map((e) => e.key)).toEqual(["hk:1", "hk:2"]);
    expect(feed.unread).toBe(2);
  });

  it("⚠️ never counts an unread item the panel does not show", () => {
    /*
     * Capping after marking would let a badge say 3 over a list of 2. Small, and it is exactly the
     * kind of small wrongness that teaches somebody the number is not worth reading.
     */
    const feed = buildFeed(raw, [], EMPTY_READ_STATE, () => true, 1);
    expect(feed.events).toHaveLength(1);
    expect(feed.unread).toBe(1);
  });

  it("⚠️ attention states are scoped by the same rule as events", () => {
    // "2 folios unsettled" tells a housekeeper what the hotel is owed. It looks like chrome and it
    // is data, which is exactly why it was nearly left unfiltered.
    const feed = buildFeed([], [
      { text: "2 folios unsettled", href: "/folios", tone: "warning" },
      { text: "3 rooms to clean", href: "/housekeeping", tone: "warning" },
    ], EMPTY_READ_STATE, hk);
    expect(feed.attention.map((a) => a.text)).toEqual(["3 rooms to clean"]);
  });

  it("⚠️ attention states are carried but never counted as unread", () => {
    // Counting them would make the badge un-clearable: the rooms are still dirty after you read it.
    const feed = buildFeed([], [{ text: "3 rooms to clean", href: "/housekeeping", tone: "warning" }],
      EMPTY_READ_STATE, () => true);
    expect(feed.attention).toHaveLength(1);
    expect(feed.unread).toBe(0);
  });

  it("respects a read mark", () => {
    const feed = buildFeed(raw, [], { clearedAt: null, readKeys: new Set(["hk:1"]) }, hk);
    expect(feed.events.map((e) => [e.key, e.read])).toEqual([["hk:1", true], ["hk:2", false]]);
    expect(feed.unread).toBe(1);
  });
});

describe("groupByDay keeps what the caller added", () => {
  it("⚠️ preserves the read flag through grouping", () => {
    /*
     * `groupByDay` was typed to return plain `NotificationEvent`, which silently widened the panel's
     * events on the way out and dropped `read` — so every row in the list would have drawn as
     * already read, and the unread dot would never have appeared. The compiler caught it; this
     * keeps it caught if the signature is ever "simplified" back.
     */
    const events = [{ ...ev({ key: "a", at: at("2026-09-14T10:00:00Z") }), read: true }];
    const [day] = groupByDay(events, "UTC", at("2026-09-14T12:00:00Z"));
    expect(day!.events[0]!.read).toBe(true);
  });
});

describe("clearedAtFor", () => {
  const now = at("2026-09-14T12:00:00Z");

  it("is just now when nothing is newer", () => {
    expect(clearedAtFor([ev({ key: "a", at: at("2026-09-14T11:00:00Z") })], now)).toEqual(now);
  });

  it("⚠️ covers an event stamped AHEAD of the server clock", () => {
    /*
     * Clock skew between the database and the app is real — the rows are timestamped by one machine
     * and compared on another. With a plain `now`, such an event stays unread forever: the badge
     * never reaches zero and pressing "mark all read" again changes nothing, which reads as a
     * broken button because it is one.
     */
    const future = ev({ key: "skewed", at: at("2026-09-14T13:00:00Z") });
    const cleared = clearedAtFor([future], now);
    expect(cleared).toEqual(at("2026-09-14T13:00:00Z"));
    expect(isRead(future, { clearedAt: cleared, readKeys: new Set() })).toBe(true);
  });

  it("never moves backwards on an empty feed", () => {
    expect(clearedAtFor([], now)).toEqual(now);
  });
});
