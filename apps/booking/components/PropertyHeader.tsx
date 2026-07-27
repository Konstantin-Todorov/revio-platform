import Link from "next/link";
import { Phone, ShieldCheck } from "lucide-react";
import type { PublicProperty } from "@/lib/property";

/**
 * The hotel's mark, pinned to the top of every step.
 *
 * It stays visible while the guest scrolls for one reason: this page lives on a Revio domain, not
 * the hotel's, and a booking flow that loses the hotel's name halfway down starts to feel like a
 * third party. Keeping the mark and the phone number in view is what makes it read as the hotel's
 * own desk rather than an intermediary's form.
 *
 * A logo when they have uploaded one, otherwise their name set in the display face — a wordmark
 * rather than a grey placeholder box, so a hotel that uploaded nothing still looks intentional.
 */
export function PropertyHeader({ property }: { property: PublicProperty }) {
  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        borderColor: "hsl(var(--line))",
        backgroundColor: "hsl(var(--surface) / 0.85)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
      }}
    >
      <div className="mx-auto flex h-[60px] w-full max-w-[72rem] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href={`/${property.slug}`} className="flex min-w-0 items-center gap-3">
          {property.logoUrl ? (
            <img
              src={property.logoUrl}
              alt={property.name}
              className="h-8 w-auto max-w-[190px] object-contain object-left sm:h-9"
            />
          ) : (
            <span className="display truncate text-[1.15rem] sm:text-[1.3rem]">{property.name}</span>
          )}
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span
            className="hidden items-center gap-1.5 text-[12.5px] font-semibold sm:flex"
            style={{ color: "hsl(var(--positive))" }}
          >
            <ShieldCheck size={14} aria-hidden />
            Official site
          </span>
          {property.phone && (
            <a
              href={`tel:${property.phone.replace(/\s+/g, "")}`}
              className="btn btn-outline min-h-[38px] px-3 text-[13px] sm:px-4"
            >
              <Phone size={14} aria-hidden />
              <span className="hidden sm:inline">{property.phone}</span>
              <span className="sr-only sm:hidden">Call {property.name}</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
