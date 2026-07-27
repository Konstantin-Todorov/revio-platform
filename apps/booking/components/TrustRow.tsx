import { BadgePercent, CreditCard, RadioTower } from "lucide-react";

/**
 * Why book here rather than on an OTA.
 *
 * Every line is a promise the platform actually keeps:
 *  - the rate really is commission-free, because no OTA is in the transaction;
 *  - nothing is charged now, because the model is a card guarantee (design §2.5②);
 *  - the availability really is live, because the booking writes to the same inventory row the
 *    channel manager pushes from — the structural claim the whole product rests on.
 *
 * No countdown timers, no "12 people are viewing". Fake urgency is exactly how OTAs lost trust, and
 * it would undermine the one claim here that is genuinely unusual.
 */
const POINTS = [
  {
    Icon: BadgePercent,
    title: "No booking fees",
    body: "You pay the hotel, not a middleman. No commission is added to your rate.",
  },
  {
    Icon: CreditCard,
    title: "Nothing charged today",
    body: "Your card guarantees the room. You settle at the hotel.",
  },
  {
    Icon: RadioTower,
    title: "Live availability",
    body: "Rooms shown here are genuinely free right now — not a cached copy.",
  },
] as const;

export function TrustRow({ checkInTime, checkOutTime }: { checkInTime: string; checkOutTime: string }) {
  return (
    <div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {POINTS.map(({ Icon, title, body }) => (
          <li key={title} className="card p-5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}
            >
              <Icon size={17} strokeWidth={2} aria-hidden />
            </span>
            <h2 className="mt-3.5 text-[14.5px] font-bold">{title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
              {body}
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
