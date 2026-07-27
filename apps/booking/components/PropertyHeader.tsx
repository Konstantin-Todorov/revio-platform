import type { PublicProperty } from "@/lib/property";

/**
 * The hotel's mark. A logo when they've uploaded one, otherwise their name set in the display face
 * — a wordmark rather than a grey placeholder box, so a hotel that hasn't uploaded anything still
 * looks intentional rather than unfinished.
 */
export function PropertyHeader({ property }: { property: PublicProperty }) {
  return (
    <header className="rise flex items-center justify-between gap-6">
      {property.logoUrl ? (
        <img
          src={property.logoUrl}
          alt={property.name}
          className="h-11 w-auto max-w-[220px] object-contain object-left sm:h-12"
        />
      ) : (
        <span className="display text-[1.4rem] tracking-tight sm:text-[1.6rem]">{property.name}</span>
      )}

      <span className="eyebrow hidden sm:block">Official site</span>
    </header>
  );
}
