/**
 * Where a hotel stands on the way from "we signed up" to "the first OTA booking arrived" — and what
 * the one next thing is.
 *
 * ## Why this exists
 *
 * The channel card carried every signal — a mapping bar, a health bar, a "Not live yet" notice, an
 * error count — and none of them said which step the hotel was on. The journey has a step that no
 * software can take for them (approving the connection inside the OTA's own extranet, root
 * CLAUDE.md "two hops"), and a hotel waiting on that step saw a green "Connected" pill and no
 * bookings, with nothing to say whether that was normal. A real owner disconnected a working channel
 * on 2026-09-15 because she believed bookings were being lost.
 *
 * So the steps are stated in order, each one done or not, and exactly one is "next" — with what the
 * hotel does about it, or, for the step that is not theirs, who does.
 *
 * Pure. The card feeds it facts it already loads.
 */

export type JourneyStepKey = "on_channex" | "mapped" | "live" | "verified" | "first_booking";

export interface JourneyStep {
  key: JourneyStepKey;
  label: string;
  done: boolean;
  /** Only on the one step that is next: what happens now, in the hotel's words. */
  next?: string;
  /** Only on the next step, when there is something to press. */
  action?: { label: string; href: string };
}

export interface JourneyFacts {
  channelName: string;
  /** The channel is bound to a property on Channex (hop 1 done). */
  onChannex: boolean;
  /** Mapping rows the Mapping screen shows, and how many of them are complete. */
  mappingRows: number;
  mappingComplete: number;
  /** `pending` = set up but not switched on at the OTA yet (hop 2). */
  status: string;
  /** A Verify read came back matching — or null when nobody has run it. */
  verifiedAt: Date | null;
  /** Bookings this channel has delivered that became stays (not failed imports). */
  bookingsReceived: number;
  /** Link target for the Mapping screen of this channel. */
  mappingHref: string;
}

export function channelJourney(f: JourneyFacts): JourneyStep[] {
  const mapped = f.mappingRows > 0 && f.mappingComplete >= f.mappingRows;
  const live = f.status === "connected";
  const steps: JourneyStep[] = [
    { key: "on_channex", label: "Your rooms and prices are set up on the channel manager", done: f.onChannex },
    { key: "mapped", label: `Every room and rate is linked to ${f.channelName}`, done: mapped },
    { key: "live", label: `${f.channelName} is switched on and selling`, done: live },
    { key: "verified", label: `${f.channelName} shows the prices and rooms you set`, done: f.verifiedAt != null },
    { key: "first_booking", label: `First booking received from ${f.channelName}`, done: f.bookingsReceived > 0 },
  ];

  const next = steps.find((s) => !s.done);
  if (!next) return steps;
  switch (next.key) {
    case "on_channex":
      next.next = "Finish Rooms & Rates first — what exists when you set up is what the channel manager receives. Then press Set up.";
      break;
    case "mapped":
      next.next = `${f.mappingRows - f.mappingComplete} of ${f.mappingRows} still need linking. Anything not linked is not on sale on ${f.channelName}, and a booking for it cannot be imported.`;
      next.action = { label: "Finish mapping", href: f.mappingHref };
      break;
    case "live":
      next.next = `${f.channelName} has to approve the connection inside its own extranet — nobody can do that step for you. Until then no prices go out and no bookings come in. Tell us when you have approved it and we switch it on.`;
      break;
    case "verified":
      next.next = `Read back what ${f.channelName} is actually showing guests and compare it with your calendar. It takes a few seconds and catches a mapping that points at the wrong room.`;
      next.action = { label: "Verify now", href: `${f.mappingHref}#verify` };
      break;
    case "first_booking":
      next.next = `Everything is in place. The first booking arrives here within seconds of a guest booking on ${f.channelName} — no bookings yet only means nobody has booked.`;
      break;
  }
  return steps;
}
