import Link from "next/link";
import { getRatesData } from "@/lib/data";
import { deleteRestrictionRule } from "@/lib/actions-rates";
import { CrsBulkPanel } from "@/components/rates/CrsBulkPanel";
import { todayInTz } from "@/lib/data";
import { RestrictionDialog } from "@/components/rates/RestrictionDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { LinkTabs } from "@revio/ui/link-tabs";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { resolveMainGuestCount } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { bulk as bulkDict } from "@/lib/i18n/bulk";

export const dynamic = "force-dynamic";

/** Bulk Rates & Availability (spec §3.7) — date-scoped ARI: the CRS twin of RevioLink's bulk
 * screen, with open/close added. Standing restriction RULES live here too (moved from the
 * dissolved Rates & Restrictions screen), keeping their source-level targeting. */
/**
 * Two tabs — change prices & availability · your standing rules — the same as RevioLink's Bulk
 * screen (docs/UI-STANDARD.md §8). Stacked, the rules sat below a long editor, a scroll away.
 */
export default async function BulkPage({ searchParams }: { searchParams: Promise<{ rt?: string; tab?: string }> }) {
  const { rt, tab: rawTab } = await searchParams;
  const tab = rawTab === "rules" ? "rules" : "change";
  const { property, ratePlans, rules, defaults, roomTypes, channels } = await getRatesData();
  // Whether the Price control is a single field or an occupancy matrix (OBP §6.4).
  const perPerson = (defaults?.pricingModel ?? "per_room") === "per_person";
  // Inline per-row bulk from the Inventory Calendar pre-scopes to one room type (?rt=CODE) —
  // the SAME code path and audit trail, never a parallel implementation (spec §3.5).
  const preselect = rt ? roomTypes.filter((r) => r.code === rt).map((r) => r.id) : undefined;
  const rtName = new Map(roomTypes.map((r) => [r.id, r.name]));
  /*
   * ⚠️ The property's date, not the server's UTC date — see `packages/core/src/stays/past-dates.ts`.
   * Bulk edits and restrictions both write FORWARD inventory; a "today" three hours behind the
   * hotel meant this screen opened on a date it should refuse, every night until 03:00 local.
   */
  const today = todayInTz(property.timezone);
  // The party size the headline price is for. Set in Settings; when nobody has set it, derived from
  // the rooms — weighted by how many of each exist — rather than read off whichever room sorted
  // first, which anchored a hotel of forty doubles on a single. A derived number is labelled
  // "assumed" downstream, so an unanswered question never reads as a decision.
  const mainGuests = resolveMainGuestCount(defaults?.mainGuestCount ?? null, roomTypes);
  const { t, day } = await i18n();
  const s = t(bulkDict);
  const SOURCE_LABEL: Record<string, string> = s.sources;
  const TYPE_LABEL: Record<string, string> = s.ruleTypes;
  // Core's note is English; word it by basis so it follows the reader's language.
  const mainGuestNote = mainGuests.basis === "derived" ? s.mainGuestNote.derived : mainGuests.basis === "fallback" ? s.mainGuestNote.fallback : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name)}
      />
      <LinkTabs
        label={s.tabsLabel}
        tabs={[
          { href: "/bulk", label: s.tabs.change, active: tab === "change" },
          { href: "/bulk?tab=rules", label: s.tabs.rules, active: tab === "rules", badge: String(rules.filter((r) => r.active).length) },
        ]}
      />

      {tab === "change" && (
      <Card surface="flat">
        <CardHeader surface="flat" title={s.cardTitle} subtitle={s.cardSubtitle} />
        {roomTypes.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-400">
            {s.noRooms}{" "}
            <Link href="/rooms-rates" className="font-semibold text-brand-600 hover:underline">{s.addRoom}</Link>.
          </p>
        ) : (
        <CrsBulkPanel
          {...(preselect && preselect.length > 0 ? { preselectRoomTypeIds: preselect } : {})}
          roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name, code: r.code, maxGuests: r.maxGuests }))}
          perPerson={perPerson}
          primaryOccupancy={mainGuests.value}
          primaryOccupancyNote={mainGuestNote}
          /*
            ⚠️ Inactive plans are passed through, not filtered out. §5.3 rule 4: a plan you cannot
            see is a plan you cannot reason about — it is shown greyed and marked "inactive" so the
            hotel knows it exists and is switched off, rather than wondering where it went.
            `selectablePlans` in @revio/core is what stops it being ticked.
          */
          ratePlans={ratePlans.map((p) => ({
            id: p.id, name: p.name, code: p.code, priceLogic: p.priceLogic, active: p.active,
            parentName: p.parent?.name ?? null,
            roomTypeIds: p.roomTypeLinks.map((l) => l.roomTypeId),
          }))}
          today={today}
        />
        )}
      </Card>
      )}

      {tab === "rules" && (<>
      <Card surface="flat">
        <CardHeader surface="flat"
          title={s.rules.title}
          subtitle={s.rules.subtitle}
          action={<RestrictionDialog today={today} roomTypes={roomTypes} channels={channels} />}
        />
        {rules.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">{s.rules.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {[s.rules.cols.rule, s.rules.cols.type, s.rules.cols.dates, s.rules.cols.room, s.rules.cols.sources, s.rules.cols.value, s.rules.cols.status].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{r.name}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={r.type === "stop_sell" ? "danger" : "info"}>{TYPE_LABEL[r.type] ?? r.type.replace(/_/g, " ")}</StatusPill></td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{day(r.dateFrom.toISOString().slice(0, 10))} → {day(r.dateTo.toISOString().slice(0, 10))}</td>
                    <td className="px-4 py-2.5 text-ink-600">{r.roomTypeId ? rtName.get(r.roomTypeId) ?? "?" : s.rules.all}</td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-500">
                      {r.sourceCategories.length === 0 ? s.rules.allSources : r.sourceCategories.map((c) => SOURCE_LABEL[c] ?? c).join(", ")}
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{r.valueInt ?? (r.valueBool ? s.rules.on : "—")}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={r.active ? "success" : "neutral"}>{r.active ? s.rules.active : s.rules.off}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <RestrictionDialog today={today} rule={r} roomTypes={roomTypes} channels={channels} />
                        <DeleteButton action={deleteRestrictionRule} id={r.id} label={r.name} note={s.rules.deleteNote} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[12px] text-ink-400">
        {s.rules.whichWins} {s.precedence}.
      </p>
      </>)}
    </div>
  );
}
