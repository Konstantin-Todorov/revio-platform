import { Check } from "lucide-react";
import { forTenant } from "@revio/db";
import type { RoomParty, RoomPick } from "@revio/core";
import type { PublicProperty } from "@/lib/property";
import type { GuestKit } from "@/lib/i18n/kit";
import { groupQuery } from "@/lib/group";

/**
 * Several rooms, chosen one at a time: which slot is being chosen now, for whom, and what is already
 * picked — with a way back to change an earlier choice. The guest always sees the whole booking
 * taking shape, the way a basket does.
 */
export async function GroupSteps({ property, rooms, picks, checkIn, checkOut, kit }: {
  property: PublicProperty; rooms: RoomParty[]; picks: RoomPick[]; checkIn: string; checkOut: string; kit: GuestKit;
}) {
  const { s } = kit;
  const db = forTenant(property.tenantId);
  const [types, plans] = await Promise.all([
    db.roomType.findMany({ where: { propertyId: property.id, id: { in: picks.map((p) => p.roomTypeId) } }, select: { id: true, name: true } }),
    db.ratePlan.findMany({ where: { propertyId: property.id, id: { in: picks.map((p) => p.ratePlanId) } }, select: { id: true, name: true } }),
  ]);
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "";
  const current = picks.length;
  return (
    <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={s.group.title}>
      {rooms.map((r, i) => {
        const pick = picks[i];
        const active = i === current;
        return (
          <li
            key={i}
            className="card flex items-start gap-3 px-4 py-3 text-[13px]"
            style={active ? { borderColor: "hsl(var(--brand))", boxShadow: "0 0 0 1px hsl(var(--brand))" } : undefined}
            aria-current={active ? "step" : undefined}
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={pick ? { backgroundColor: "hsl(var(--positive) / 0.12)", color: "hsl(var(--positive))" } : active ? { backgroundColor: "hsl(var(--brand))", color: "hsl(var(--brand-ink))" } : { backgroundColor: "hsl(var(--surface-sunk))" }}
            >
              {pick ? <Check size={13} aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.bar.roomN(i + 1)} · {s.bar.party(r.adults, r.childAges.length)}</span>
              {pick ? (
                <span className="block" style={{ color: "hsl(var(--ink-soft))" }}>
                  {name(types, pick.roomTypeId)} · {name(plans, pick.ratePlanId)}{" "}
                  <a
                    href={`/${property.slug}/search?${groupQuery({ checkIn, checkOut, rooms, picks: picks.slice(0, i) })}`}
                    className="link-quiet font-semibold"
                  >
                    {s.group.change}
                  </a>
                </span>
              ) : (
                <span className="block" style={{ color: active ? "hsl(var(--brand-text))" : "hsl(var(--ink-faint))" }}>
                  {active ? s.group.chooseNow : s.group.next}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
