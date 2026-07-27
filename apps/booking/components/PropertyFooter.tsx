import type { PublicProperty } from "@/lib/property";

/**
 * The hotel's own details, closing every page.
 *
 * There is no Revio branding here on purpose. This is the hotel's booking page, and a platform
 * byline at the bottom of it would tell a guest they are transacting with someone other than the
 * hotel — the exact impression the product exists to remove.
 */
export function PropertyFooter({ property }: { property: PublicProperty }) {
  return (
    <footer className="border-t" style={{ borderColor: "hsl(var(--line))", backgroundColor: "hsl(var(--surface))" }}>
      <div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-start justify-between gap-x-10 gap-y-6 px-5 py-10 sm:px-8">
        <div className="min-w-0">
          <p className="display text-[1.05rem]">{property.name}</p>
          {property.address && (
            <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
              {property.address}
            </p>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
            {property.phone && (
              <a href={`tel:${property.phone.replace(/\s+/g, "")}`} className="link-quiet">
                {property.phone}
              </a>
            )}
            {property.contactEmail && (
              <a href={`mailto:${property.contactEmail}`} className="link-quiet">
                {property.contactEmail}
              </a>
            )}
          </p>
        </div>

        <p className="text-[12.5px] leading-relaxed" style={{ color: "hsl(var(--ink-faint))" }}>
          Check-in from {property.checkInTime} · Check-out by {property.checkOutTime}
          <br />
          Prices include all taxes and fees.
        </p>
      </div>
    </footer>
  );
}
