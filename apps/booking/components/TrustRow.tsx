/**
 * Why book here rather than on an OTA.
 *
 * Every line is a promise the platform actually keeps:
 *  - the rate really is commission-free, because no OTA is in the transaction;
 *  - nothing is charged now, because the model is a card guarantee (design §2.5②);
 *  - the availability really is live, because the booking writes to the same inventory row the
 *    channel manager pushes from — the structural claim the whole product rests on.
 *
 * No countdown timers, no "12 people are viewing". Fake urgency is exactly how OTAs lost trust,
 * and it would undermine the one claim here that is genuinely unusual.
 */
const POINTS: { title: string; body: string }[] = [
  { title: "No booking fees", body: "You pay the hotel, not a middleman. No commission is added to your rate." },
  { title: "Nothing charged today", body: "Your card guarantees the room. You settle at the hotel." },
  { title: "Live availability", body: "Rooms shown here are genuinely free right now — not a cached copy." },
];

export function TrustRow({ checkInTime, checkOutTime }: { checkInTime: string; checkOutTime: string }) {
  return (
    <div>
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 rule"
          style={{ backgroundColor: "hsl(var(--rule))" }}>
        {POINTS.map((p) => (
          <li key={p.title} className="px-5 py-5" style={{ backgroundColor: "hsl(var(--paper-raised))" }}>
            <div className="flex items-baseline gap-2">
              <span aria-hidden className="text-[13px]" style={{ color: "hsl(var(--brand-text))" }}>—</span>
              <h2 className="text-[14px] font-semibold">{p.title}</h2>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
              {p.body}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
        Check-in from {checkInTime}, check-out by {checkOutTime}.
      </p>
    </div>
  );
}
