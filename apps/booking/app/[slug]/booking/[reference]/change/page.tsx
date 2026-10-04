import { notFound, redirect } from "next/navigation";
import { manageAbility } from "@revio/booking";
import { todayInTimeZone } from "@revio/core";
import { getPublicProperty } from "@/lib/property";
import { allInTotal, findByReference, mayManage } from "@/lib/manage";
import { serverKit } from "@/lib/i18n/server";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { ChangeDates } from "@/components/ChangeDates";

export const dynamic = "force-dynamic";

/**
 * Change dates — same room, same rate, new nights, and the new price shown before anything moves.
 *
 * Reached only with the key from the confirmation email; without it, or once the booking can no
 * longer be moved online, the guest is sent back to the booking page, which says why.
 */
export default async function ChangeDatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; reference: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug, reference } = await params;
  const { k } = await searchParams;
  const property = await getPublicProperty(slug);
  if (!property) notFound();
  const r = await findByReference(property, reference);
  if (!r) notFound();
  const line = r.lines[0];
  if (!line) notFound();
  const back = `/${property.slug}/booking/${reference.toUpperCase()}${k ? `?k=${encodeURIComponent(k)}` : ""}`;
  const checkIn = line.checkIn.toISOString().slice(0, 10);
  const checkOut = line.checkOut.toISOString().slice(0, 10);
  if (!(await mayManage(r, k)) || !manageAbility({ ...r, checkIn, today: todayInTimeZone(property.timezone) }).canChange) {
    redirect(back);
  }

  const { s } = await serverKit(property);
  return (
    <>
      <PropertyHeader property={property} />
      <main className="mx-auto w-full max-w-[66rem] px-5 pb-20 pt-8 sm:px-8">
        <a href={back} className="link-quiet text-[13.5px]">← {s.manage.back}</a>
        <h1 className="display mt-4 text-[1.9rem] sm:text-[2.3rem]">{s.manage.changeTitle}</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
          {s.manage.changeLead(`${line.roomType?.name ?? ""}${line.ratePlan?.name ? ` · ${line.ratePlan.name}` : ""}`)}
        </p>
        <ChangeDates
          slug={property.slug}
          reference={reference.toUpperCase()}
          manageKey={k!}
          current={{ checkIn, checkOut, totalMinor: await allInTotal(property, r) }}
          guests={line.guestsCount ?? 2}
          childAges={line.childAges}
          currency={r.currency}
        />
      </main>
      <PropertyFooter property={property} />
    </>
  );
}
