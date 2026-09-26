import { getRoomsAndRates, getRestrictions } from "@/lib/data";
import { deleteRestrictionRule } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { LinkTabs } from "@revio/ui/link-tabs";
import { BulkUpdatePanel } from "@/components/bulk/BulkUpdatePanel";
import { RestrictionDialog } from "@/components/restrictions/RestrictionDialog";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ymd } from "@/lib/format";
import { channelSupports, todayInTimeZone } from "@revio/core";
import { getProperty } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { bulk as bulkDict } from "@/lib/i18n/bulk";

export const dynamic = "force-dynamic";

/**
 * V2 IA: Bulk Update and Restrictions are ONE screen — one-off mass edits, and the standing rules.
 * Two tabs since 2026-09-25 (docs/UI-STANDARD.md §8): stacked, the rules sat below a long editor
 * and were a scroll away from anyone who came to read them; a tab says how many there are unopened.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ rt?: string; tab?: string }> }) {
  const { rt, tab: rawTab } = await searchParams;
  const tab = rawTab === "rules" ? "rules" : "change";
  const [property, { roomTypes, ratePlans }, { rules, channels }, { t, day }] = await Promise.all([getProperty(), getRoomsAndRates(), getRestrictions(), i18n()]);
  const s = t(bulkDict);
  const typeLabel = (type: string) => s.ruleTypes[type as keyof typeof s.ruleTypes] ?? type;
  // Capability flags (spec §3.3 / §5.2): a rule aimed at a channel that can't honour its type is
  // flagged here, not silently created — and it is a limitation, never an error.
  const ignoredBy = (rule: { type: string; channelCodes: string[] }): string[] => {
    const targets = rule.channelCodes.length > 0 ? channels.filter((c) => rule.channelCodes.includes(c.code)) : channels;
    return targets.filter((c) => !channelSupports(c.supportedRestrictions, rule.type as Parameters<typeof channelSupports>[1])).map((c) => c.name);
  };
  // Inline per-row bulk from the calendar pre-scopes to one room type (?rt=CODE).
  const preselect = rt ? roomTypes.filter((r) => r.code === rt).map((r) => r.id) : undefined;
  /*
   * ⚠️ The property's date, not the server's UTC date — see `packages/core/src/stays/past-dates.ts`.
   * A bulk edit and a restriction both write FORWARD inventory, so "today" being a day behind meant
   * the screen opened on a date it should refuse, every night between midnight and 03:00 local.
   */
  const today = todayInTimeZone(property.timezone);
  const rtOpts = roomTypes.map((r) => ({ id: r.id, name: r.name }));
  const rpOpts = ratePlans.map((p) => ({ id: p.id, name: p.roomTypeLinks.length ? `${p.roomTypeLinks.map((l) => l.roomType.name).join(", ")} · ${p.name}` : p.name }));
  const chOpts = channels.map((c) => ({ code: c.code, name: c.name }));

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <div className="mb-4">
        <LinkTabs
          label={s.tabsLabel}
          tabs={[
            { href: "/bulk-update", label: s.tabs.change, active: tab === "change" },
            { href: "/bulk-update?tab=rules", label: s.tabs.rules, active: tab === "rules", badge: String(rules.filter((r) => r.active).length) },
          ]}
        />
      </div>
      {tab === "change" && (roomTypes.length === 0 ? (
        <Card surface="flat" className="p-8 text-center text-[13px] text-ink-400">
          {s.noRooms}{" "}
          <a href="/rooms-rates" className="font-semibold text-brand-600 hover:underline">{s.addRoom}</a>.
        </Card>
      ) : (
      <BulkUpdatePanel
        roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name, code: r.code }))}
        ratePlans={ratePlans.map((p) => ({
          id: p.id, name: p.name, code: p.code, priceLogic: p.priceLogic, active: p.active,
          parentName: p.parent?.name ?? null,
          // The selector is room-scoped: a plan is offered under each room it is linked to.
          roomTypeIds: p.roomTypeLinks.map((l) => l.roomTypeId),
        }))}
        today={today}
        {...(preselect ? { preselectRoomTypeIds: preselect } : {})}
      />
      ))}

      {tab === "rules" && (<>
      <Card surface="flat">
        <CardHeader surface="flat" title={s.rules.title} action={<RestrictionDialog today={today} roomTypes={rtOpts} ratePlans={rpOpts} channels={chOpts} />} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {[s.rules.cols.rule, s.rules.cols.type, s.rules.cols.appliesTo, s.rules.cols.dates, s.rules.cols.channels, s.rules.cols.value, s.rules.cols.status].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{r.name}</td>
                  <td className="px-4 py-2.5"><StatusPill tone="info">{typeLabel(r.type)}</StatusPill></td>
                  <td className="px-4 py-2.5 text-ink-600">{r.roomTypeId ? r.roomTypeName : s.dialog.allRooms}</td>
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-ink-600">{day(ymd(r.dateFrom))} → {day(ymd(r.dateTo))}</td>
                  <td className="px-4 py-2.5 text-ink-500">
                    {r.channelCodes.length === channels.length ? s.rules.all : r.channelCodes.join(", ")}
                    {ignoredBy(r).length > 0 && (
                      <span title={s.rules.ignoredTitle} className="ml-1.5 rounded bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-warning-700">
                        {s.rules.ignoredBy(ignoredBy(r).join(", "))}
                      </span>
                    )}
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{r.valueInt ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={r.active ? "success" : "neutral"}>{r.active ? s.rules.active : s.rules.inactive}</StatusPill></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RestrictionDialog today={today} rule={r} roomTypes={rtOpts} ratePlans={rpOpts} channels={chOpts} />
                      <DeleteButton action={deleteRestrictionRule} id={r.id} label={r.name} />
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-ink-400">{s.rules.empty}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-ink-400">{s.rules.precedence}</p>
      </>)}
    </div>
  );
}
