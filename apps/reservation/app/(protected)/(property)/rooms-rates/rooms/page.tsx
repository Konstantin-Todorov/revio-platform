import Link from "next/link";
import { ChevronRight, ImageOff } from "lucide-react";
import { getObjectStore } from "@revio/storage";
import { getSetupData } from "@/lib/data";
import { RoomTypeDialog } from "@/components/rates/RoomTypeDialog";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { Card, CardHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { rates as ratesDict } from "@/lib/i18n/rates";

export const dynamic = "force-dynamic";

/**
 * Room types — every room the hotel sells, each opening onto one page with everything about it. The
 * row warns quietly about what a GUEST would miss (no photo, no description), because those are the
 * gaps a hotel does not see from the inside.
 */
export default async function RoomTypesPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const [{ roomTypes }, store] = await Promise.all([getSetupData(), getObjectStore()]);
  const s = (await i18n()).t(ratesDict);

  return (
    <>
      <BlockedNotice name={blocked} text={blocked ? s.blocked(blocked) : undefined} />
      <Card>
        <CardHeader
          title={s.rooms.title}
          subtitle={s.rooms.subtitle}
          action={<RoomTypeDialog />}
        />
        {roomTypes.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-[13px] text-ink-500">
            {s.rooms.empty}
          </p>
        ) : (
          <ul className="divide-y divide-surface-border/70 border-t border-surface-border/70">
            {roomTypes.map((rt) => {
              const cover = rt.photos[0];
              const missing = [
                rt.photos.length === 0 ? ("photo" as const) : null,
                rt.description ? null : ("description" as const),
              ].filter((x): x is "photo" | "description" => x != null);
              return (
                <li key={rt.id}>
                  <Link href={`/rooms-rates/rooms/${rt.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted">
                    <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-muted text-ink-300">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- our own already-resized WebP thumbnail
                        <img src={store.publicUrl(cover.thumbKey)} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <ImageOff className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13.5px] font-semibold ${rt.active ? "text-ink-900" : "text-ink-400"}`}>
                        {rt.name}
                        {!rt.active && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">{s.inactive}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-500">
                        {rt.code} · {s.rooms.units(rt.totalRooms, rt.unitKind)} · {s.rooms.sleeps(rt.maxGuests)}
                        {rt.photos.length > 0 && ` · ${s.rooms.photos(rt.photos.length)}`}
                      </span>
                      {missing.length > 0 && (
                        <span className="mt-0.5 block text-[11px] font-medium text-warning-700">{s.rooms.guestsSee(missing)}</span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
