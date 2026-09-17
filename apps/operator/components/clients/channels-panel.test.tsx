import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
 * The server actions are irrelevant to what the panel says, and importing them would drag Prisma
 * into a render test — same trick the integrations view test uses.
 */
vi.mock("@/lib/actions-channels", () => ({
  operatorPauseChannel: "/__action",
  operatorResumeChannel: "/__action",
  operatorDisconnectChannel: "/__action",
  operatorReconnectChannel: "/__action",
  operatorDeleteChannel: "/__action",
  operatorActivateChannel: "/__action",
}));

import { ChannelsPanel, type ChannelRow } from "@/components/clients/ChannelsPanel";

const row = (over: Partial<ChannelRow> = {}): ChannelRow => ({
  id: "ch1", name: "Channex", code: "channex", status: "connected", mode: "channex_prod",
  externalPropertyId: "d06f812c-fdfd-40ec-b20a-55967b9059ed",
  lastSyncAt: new Date(), errorCount: 0,
  catalogueCheckedAt: new Date(), catalogueStatus: "ok",
  propertyName: "Chervena Vila", reservations: 0, crossWired: [],
  ...over,
});

const html = (channels: ChannelRow[], suspended = false) =>
  renderToStaticMarkup(<ChannelsPanel channels={channels} suspended={suspended} />);

describe("what the panel refuses to offer", () => {
  /*
   * ⚠️ `Reservation.channel` cascades. A "Remove" beside a channel with bookings is not a dangerous
   * control, it is a trap — Postgres would take the bookings, their guests and their folios,
   * silently. There must be nothing to click.
   */
  it("offers no Remove at all when bookings came through the channel", () => {
    // Disconnected, so somebody plausibly IS reaching for delete and gets told why there is none.
    const out = html([row({ reservations: 40, status: "disconnected" })]);
    expect(out).not.toMatch(/Remove/);
    expect(out).toMatch(/40 bookings came through it and would go too/);
    expect(out).toMatch(/Disconnect instead/);
  });

  /*
   * ⚠️ On a healthy channel the refusal is not printed at all. Under every working row it was four
   * repetitions of an apology for something nobody was trying to do.
   */
  it("says nothing about removal on a channel nobody would be removing", () => {
    const out = html([row({ reservations: 40, status: "connected" })]);
    expect(out).not.toMatch(/Remove/);
    expect(out).not.toMatch(/Cannot be removed/);
    // The fact that stops the question being asked is already there.
    expect(out).toMatch(/Bookings taken/);
  });

  it("offers Remove when the channel never produced anything", () => {
    expect(html([row({ reservations: 0 })])).toMatch(/Remove/);
  });
});

describe("what it says about a suspended account", () => {
  /*
   * The dangerous assumption is that suspending took the hotel off the OTAs. It did not, and a guest
   * can still book into an account nobody can sign in to.
   */
  it("says the rooms are still on sale, and names the control that stops that", () => {
    const out = html([row()], true);
    expect(out).toMatch(/nothing syncs/);
    expect(out).toMatch(/still on sale/);
    expect(out).toMatch(/Pause a channel below to stop-sell it/);
  });

  it("says nothing of the sort for an active account", () => {
    expect(html([row()], false)).not.toMatch(/still on sale/);
  });
});

describe("what it surfaces without being asked", () => {
  it("leads with the consequence when the channel's property is gone", () => {
    const out = html([row({ catalogueStatus: "property_missing" })]);
    expect(out).toMatch(/property is gone/);
    expect(out).toMatch(/Nothing sent is arriving/);
  });

  it("distinguishes 'could not be read' from 'has none'", () => {
    const out = html([row({ catalogueStatus: "unreadable" })]);
    expect(out).toMatch(/could not be read/);
    expect(out).toMatch(/not the same as having none/);
  });

  it("names a cross-wired plan and why nobody has noticed it", () => {
    const out = html([
      row({ crossWired: [{ roomTypeName: "Apartment, 2 Bedrooms", ratePlanName: "Standard Rate", externalRateId: "0ea321e7", checkedAt: new Date() }] }),
    ]);
    expect(out).toMatch(/Apartment, 2 Bedrooms · Standard Rate/);
    expect(out).toMatch(/looks finished and every push succeeds/);
  });

  it("shows the channel's own property id, selectable, for quoting back at them", () => {
    expect(html([row()])).toMatch(/select-all[^>]*>d06f812c-fdfd-40ec-b20a-55967b9059ed/);
  });

  it("says plainly when there is nothing being distributed", () => {
    expect(html([])).toMatch(/Nothing is being distributed/);
  });
});

describe("the controls offered for each state", () => {
  it("offers Pause on a live channel and Resume on a paused one", () => {
    expect(html([row({ status: "connected" })])).toMatch(/Pause/);
    expect(html([row({ status: "paused" })])).toMatch(/Resume/);
    expect(html([row({ status: "paused" })])).not.toMatch(/>Pause</);
  });

  it("offers Reconnect rather than Disconnect once disconnected", () => {
    const out = html([row({ status: "disconnected" })]);
    expect(out).toMatch(/Reconnect/);
    expect(out).not.toMatch(/>Disconnect</);
  });
});

describe("Resume on a suspended account", () => {
  /*
   * Resume marks the channel connected and then re-pushes 365 days to lift the stop-sell. On a
   * suspended account that push is refused, so the button would leave a channel reading live and
   * selling nothing. The server refuses it; the panel must not invite it either.
   */
  it("is not offered, and says what to do instead", () => {
    const out = html([row({ status: "paused" })], true);
    expect(out).not.toMatch(/>Resume</);
    expect(out).toMatch(/Reinstate the account to resume/);
  });

  it("is offered once the account is active again", () => {
    expect(html([row({ status: "paused" })], false)).toMatch(/Resume/);
  });
});

describe("a demo connection", () => {
  /*
   * The audit only talks to real channels, so "Listings checked never" against a mock reads as
   * neglect rather than as not-applicable. A screen that invents work is worse than a quiet one.
   */
  it("is not reported as never checked", () => {
    const out = html([row({ mode: "mock", catalogueCheckedAt: null, catalogueStatus: null })]);
    expect(out).toMatch(/demo connection/);
    expect(out).not.toMatch(/Listings checked/);
  });

  it("but a real channel always says when it was last confirmed", () => {
    expect(html([row({ mode: "channex_prod", catalogueCheckedAt: null })])).toMatch(/Listings checked/);
  });
});

describe("a channel that is set up but not switched on", () => {
  const pending = () => row({ status: "pending", reservations: 0, catalogueStatus: null, catalogueCheckedAt: null });

  /*
   * ⚠️ `pending` is a database word. It also already means something else in this product — the spec
   * uses it for the outbox queue depth — so printing it raw is both jargon and ambiguous jargon.
   */
  it("never shows the database word", () => {
    const out = html([pending()]);
    expect(out).toMatch(/not live yet/);
    expect(out).not.toMatch(/>pending</);
  });

  /*
   * The only control in this panel that STARTS something: the OTA begins selling and Channex begins
   * billing us for the property. It exists here and not on the hotel's own screen because we are the
   * Channex customer and they have no account there.
   */
  it("offers Go live, and only in this state", () => {
    expect(html([pending()])).toMatch(/Go live/);
    expect(html([row({ status: "connected" })])).not.toMatch(/Go live/);
    expect(html([row({ status: "paused" })])).not.toMatch(/Go live/);
    expect(html([row({ status: "disconnected" })])).not.toMatch(/Go live/);
  });
});
