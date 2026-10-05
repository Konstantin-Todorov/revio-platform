import { Star } from "lucide-react";
import { formatRating } from "@revio/core";
import type { PublicProperty } from "@/lib/property";
import type { GuestStrings } from "@/lib/i18n/guest";

/**
 * The hotel's public scores, said where the guest decides: under the search bar.
 *
 * A guest's next move after a hotel's own site is usually to open Booking.com "to check the
 * reviews" — and the booking happens there. Quoting the score here, linked to the source so it can
 * be checked, answers that question without the trip. The names are plain text, never the sites'
 * logos: their marks are theirs to license, and the link already says where the number comes from.
 */
export function RatingBadges({ ratings, s, locale, onDark = false, align = "center" }: {
  ratings: PublicProperty["ratings"];
  s: GuestStrings["ratings"];
  locale: string;
  onDark?: boolean;
  align?: "center" | "start";
}) {
  if (ratings.length === 0) return null;
  const chip = onDark
    ? { backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff", borderColor: "rgba(255,255,255,0.28)" }
    : { backgroundColor: "hsl(var(--surface))", color: "hsl(var(--ink))", borderColor: "hsl(var(--line))" };
  return (
    <ul className={`flex flex-wrap gap-2 ${align === "center" ? "justify-center" : ""}`} aria-label={s.label}>
      {ratings.map((r) => {
        const body = (
          <>
            <span className="font-semibold">{r.source === "booking" ? "Booking.com" : "Google"}</span>
            <span className="inline-flex items-center gap-0.5 font-bold nums">
              {r.source === "google" && <Star size={12} aria-hidden fill="currentColor" style={{ color: onDark ? "#ffd166" : "#e3a008" }} />}
              {formatRating(r.scoreTenths, locale)}
              <span className="font-normal opacity-70">/{r.source === "booking" ? "10" : "5"}</span>
            </span>
            {r.reviewCount != null && <span className="opacity-75 nums">· {s.reviews(r.reviewCount)}</span>}
          </>
        );
        return (
          <li key={r.source}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-opacity hover:opacity-85" style={chip}>
                {body}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]" style={chip}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
