import Link from "next/link";
import { notFound } from "next/navigation";
import { getObjectStore } from "@revio/storage";
import { getRatesData, getSetupData } from "@/lib/data";
import { deleteRoomType } from "@/lib/actions-rates";
import { RoomTypeEditor } from "@/components/rates/RoomTypeForm";
import { PhotoGallery } from "@/components/rates/PhotoGallery";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { BackLink } from "@/components/rates/BackLink";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * One room type, top to bottom in the order a listing is read: the basics, what a guest reads, its
 * photos, the plans that sell it. The shape of the Booking.com extranet and Airbnb's listing editor —
 * a room owns its photos and its description, so they are edited where the room is.
 */
export default async function RoomTypePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const [{ id }, { blocked }] = await Promise.all([params, searchParams]);
  const [{ roomTypes }, { ratePlans }, store] = await Promise.all([getSetupData(), getRatesData(), getObjectStore()]);
  const rt = roomTypes.find((r) => r.id === id);
  if (!rt) notFound();
  const soldOn = ratePlans.filter((rp) => rp.roomTypeLinks.some((l) => l.roomTypeId === rt.id));

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

      <RoomTypeEditor roomType={rt} />

      <Card>
        <CardHeader title="Photos" subtitle="Shown to guests on your booking page. The first photo is the room's cover" />
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

      <Card>
        <CardHeader title="Sold on" subtitle="The rate plans that sell this room — each one's price applies to it" />
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
  );
}
