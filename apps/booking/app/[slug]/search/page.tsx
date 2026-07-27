import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicProperty } from "@/lib/property";
import { PropertyHeader } from "@/components/PropertyHeader";

export const dynamic = "force-dynamic";

/**
 * Step 2 — results. K1 lands the route and its guards; K2 fills in real availability and pricing
 * through `publicAvailability()`, and K3 turns each option into a room card.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  return (
    <main className="mx-auto w-full max-w-[68rem] px-5 pb-24 pt-8 sm:px-8 sm:pt-14">
      <PropertyHeader property={property} />
      <div className="mt-12">
        <Link href={`/${property.slug}`} className="eyebrow hover:underline">← Change dates</Link>
        <h1 className="display mt-4 text-[2rem] sm:text-[2.6rem]">
          {sp.checkIn && sp.checkOut ? `${sp.checkIn} → ${sp.checkOut}` : "Choose your dates"}
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: "hsl(var(--ink-soft))" }}>
          Availability and pricing arrive with the next step of the build.
        </p>
      </div>
    </main>
  );
}
