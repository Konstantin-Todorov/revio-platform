import { Clock, Users } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getStaff } from "@/lib/data";
import { getSession } from "@/lib/session";
import { getWorkforceSummary, getShiftHistory } from "@/lib/workforce";
import { ShiftHistory } from "@/components/users/ShiftHistory";
import { UsersManager } from "@/components/users/UsersManager";
import { clockInUser, clockOutUser } from "@/lib/actions-workforce";
import { DELEGATOR_ROLES } from "@/lib/roles";
import { i18n } from "@/lib/i18n/server";
import { users as usersDict } from "@/lib/i18n/users";
import { shell } from "@/lib/i18n/shell";
import { LOCALE_LABELS } from "@revio/ui/i18n";

export const dynamic = "force-dynamic";

/** The shift record's default window. Long enough to see a pattern, short enough to read. */
const HISTORY_DAYS = 14;

export default async function UsersPage() {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_DAYS * 86_400_000);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);

  const [{ property, users, meId, canManage }, workforce, history, session] = await Promise.all([
    getStaff(),
    getWorkforceSummary(),
    getShiftHistory(fromIso, toIso),
    getSession(),
  ]);

  /*
   * Reception can delegate as well as managers — DELEGATOR_ROLES on the action says so, and the
   * front desk is who notices that the cleaner on the second floor never clocked in. `canManage` is
   * the narrower gate for the shift HISTORY below, which is employee data rather than a live board.
   */
  const canDelegate = DELEGATOR_ROLES.has(session?.role ?? "");
  const { t: tr, locale } = await i18n();
  const t = tr(usersDict);
  const roles = tr(shell).roles;
  // The property's wall clock, not the server's UTC: "since 06:00" for a 09:00 Sofia clock-in was
  // three hours wrong on every shift.
  const clock = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: property.timezone });
  const onShift = new Set(workforce.groups.flatMap((g) => g.active.map((a) => a.userId)));
  const offShift = users.filter((u) => u.active && !onShift.has(u.id));

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(property.name)}
      />

      {/* Workforce dashboard (§10.2) — who's available right now, grouped by role/department, live (not
          history). Fed by the J0 clock-in mechanism (StaffShift). Availability + light KPI, not payroll. */}
      <Card className="mb-4">
        <CardHeader
          title={t.working.title}
          subtitle={t.working.subtitle}
          action={<span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-400"><Clock className="h-3.5 w-3.5" />{t.working.active(workforce.totalActive)}</span>}
        />
        {workforce.totalActive === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-ink-400">
            {t.working.none}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {workforce.groups.map((g) => (
              <div key={g.role} className="rounded-lg border border-surface-border bg-surface-muted/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{roles[g.role] ?? g.roleLabel}</span>
                  <span className="tnum rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-ink-600">{g.active.length}</span>
                </div>
                <ul className="space-y-1">
                  {g.active.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-1.5 text-ink-800"><Users className="h-3 w-3 text-ink-400" />{s.userName}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="tnum text-[11px] text-ink-400">{t.working.since(clock.format(s.clockInAt))}{s.delegated ? t.working.byStaff : ""}</span>
                        {canDelegate && (
                          <form action={clockOutUser}>
                            <input type="hidden" name="userId" value={s.userId} />
                            <button type="submit" title={t.working.clockOutTitle(s.userName)} className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-400 transition-colors hover:bg-white hover:text-danger-600">
                              {t.working.clockOut}
                            </button>
                          </form>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {canDelegate && offShift.length > 0 && (
          /*
           * Delegated clock-in (§10.2). The card has always rendered "· by staff" for a shift somebody
           * else started, and until now nothing could produce one: the actions existed, gated and
           * tested, with no control anywhere. A cleaner without a phone, or one who forgot, was simply
           * absent from the record.
           */
          <form action={clockInUser} className="flex flex-wrap items-center gap-2 border-t border-surface-border/60 px-4 py-3">
            <label className="text-[11.5px] font-semibold text-ink-500">{t.working.clockSomeoneIn}</label>
            <select name="userId" defaultValue="" className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-900">
              {offShift.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button type="submit" className="h-8 rounded-md bg-brand-700 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-800">
              {t.working.clockIn}
            </button>
            <span className="text-[11px] text-ink-400">{t.working.recordedAsYou}</span>
          </form>
        )}
      </Card>

      {/* Manager-only. Hiding it from a housekeeper is not just tidiness: a record of when colleagues
          worked is employee data, and the route guard already keeps scoped roles off this screen —
          this is the second gate for a manager-less role that can still reach it. */}
      {canManage && <ShiftHistory people={history} fromIso={fromIso} toIso={toIso} t={t.shifts} roles={roles} />}

      <UsersManager users={users} meId={meId} canManage={canManage} t={t.manager} roles={roles} />
    </div>
  );
}
