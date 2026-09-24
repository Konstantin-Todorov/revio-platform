import Link from "next/link";
import { notFound } from "next/navigation";
import { getObjectStore } from "@revio/storage";
import { getRatesData, getSetupData } from "@/lib/data";
import { deleteRoomType } from "@/lib/actions-rates";
import { RoomTypeSectionForm } from "@/components/rates/RoomTypeForm";
import { PhotoGallery } from "@/components/rates/PhotoGallery";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { BackLink } from "@/components/rates/BackLink";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { LinkTabs } from "@revio/ui/link-tabs";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const TABS = ["basics", "guest", "photos", "plans"] as const;
type Tab = (typeof TABS)[number];

/**
 * One room type, in four tabs: the basics, what a guest reads, its photos, the plans that sell it —
 * the shape of the Booking.com extranet and Airbnb's listing editor, where a room owns its photos and
 * its description.
 *
 * Tabs rather than one long page (founder, 2026-09-25): stacked, the page ran basics → thirty-five
 * amenity chips → a save bar in the middle → photos → plans, and a save button with more page after
 * it reads as if it saved everything below it too. Now each tab is one card whose save is its last
 * line, and the dot on a tab says a guest would miss something there before it is opened.
 */
export default async function RoomTypePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string; tab?: string }>;
}) {
  const [{ id }, { blocked, tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "basics";
  const [{ roomTypes }, { ratePlans }, store] = await Promise.all([getSetupData(), getRatesData(), getObjectStore()]);
  const rt = roomTypes.find((r) => r.id === id);
  if (!rt) notFound();
  const soldOn = ratePlans.filter((rp) => rp.roomTypeLinks.some((l) => l.roomTypeId === rt.id));
  const base = `/rooms-rates/rooms/${rt.id}`;
  const guestGap = !rt.description && !rt.sizeSqm && !rt.bedSetup && rt.amenities.length === 0;

  return (
    <>
      <BackLink href="/rooms-rates/rooms">All room types</BackLink>
      <BlockedNotice name={blocked} />
      <div>
        <h2 className="text-[18px] font-bold tracking-tight text-ink-900">
          {rt.name}
          {!rt.active && <span className="ml-2 align-middle text-[10.5px] font-bold uppercase text-ink-400">inactive</span>}
        </h2>
        <p className="text-[12px] text-ink-500">{rt.code} · {rt.totalRooms} physical · sleeps {rt.maxGuests}</p>
      </div>

      <LinkTabs
        label={`${rt.name} views`}
        tabs={[
          { href: base, label: "Basics", active: tab === "basics" },
          { href: `${base}?tab=guest`, label: "What a guest reads", active: tab === "guest", warn: guestGap },
          { href: `${base}?tab=photos`, label: "Photos", active: tab === "photos", badge: String(rt.photos.length), warn: rt.photos.length === 0 },
          { href: `${base}?tab=plans`, label: "Rate plans", active: tab === "plans", badge: String(soldOn.length) },
        ]}
      />

      {tab === "basics" && (
        <>
          <RoomTypeSectionForm key={`${rt.id}-basics`} roomType={rt} section="basics" />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
            <p className="text-[12px] text-ink-500">
              Delete this room type. One with reservations or physical rooms behind it is deactivated instead, so history stays intact.
            </p>
            <DeleteButton
              action={deleteRoomType}
              id={rt.id}
              label={rt.name}
              note="Room types with reservations or physical rooms behind them are deactivated instead, so history stays intact."
            />
          </div>
        </>
      )}

      {tab === "guest" && <RoomTypeSectionForm key={`${rt.id}-guest`} roomType={rt} section="content" />}

      {tab === "photos" && (
        <Card>
          <CardHeader title="Photos" subtitle="Shown to guests on your booking page, in this order" />
          <div className="px-5 pb-5">
            <PhotoGallery
              roomTypeId={rt.id}
              roomTypeName={rt.name}
              photos={rt.photos.map((p) => ({
                id: p.id, thumbUrl: store.publicUrl(p.thumbKey), alt: p.alt,
                width: p.width, height: p.height, byteSize: p.byteSize,
              }))}
            />
          </div>
        </Card>
      )}

      {tab === "plans" && (
        <Card>
          <CardHeader title="Rate plans that sell this room" subtitle="Each plan's price applies to this room — open one to see how it prices" />
          <div className="px-5 pb-5">
            {soldOn.length === 0 ? (
              <p className="text-[13px] text-ink-500">No rate plan sells this room yet, so no guest can book it.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {soldOn.map((rp) => (
                  <li key={rp.id}>
                    <Link
                      href={`/rooms-rates/plans/${rp.id}`}
                      className={`inline-flex items-center rounded-full border border-surface-border px-2.5 py-1 text-[12px] font-semibold hover:border-ink-300 ${rp.active ? "text-ink-700" : "text-ink-400 line-through"}`}
                    >
                      {rp.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
