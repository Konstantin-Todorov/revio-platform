import { AlertTriangle, CalendarRange } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/roles";
import { formatMinutes, shiftTotals, SUSPECT_HOURS, type PersonShifts } from "@/lib/shifts";

/**
 * Who worked, when — the other half of "Working today".
 *
 * The live panel above it answers availability. This answers the question a manager asks afterwards,
 * and until now the rows existed and nothing displayed them.
 *
 * Two rules it follows on purpose:
 *
 *  - **An open shift is never shown as a duration.** A dash, and a count beside the total. Filling in
 *    "so far" would make a forgotten clock-out look like work.
 *  - **It is not a leaderboard.** Ordered by hours because the usual question is about cover, but
 *    there are no ranks, no targets and no comparison between people — the schema note about EU
 *    worker monitoring was written when this data was designed and it still applies to the screen.
 */
export function ShiftHistory({ people, fromIso, toIso }: { people: PersonShifts[]; fromIso: string; toIso: string }) {
  const totals = shiftTotals(people);

  return (
    <Card className="mb-4">
      <CardHeader
        title="Shift record"
        subtitle={`${fromIso} → ${toIso} · who worked and for how long`}
        action={
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-400">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatMinutes(totals.closedMinutes)} across {totals.people} {totals.people === 1 ? "person" : "people"}
          </span>
        }
      />

      {people.length === 0 ? (
        <p className="px-4 py-4 text-[12.5px] text-ink-400">
          No shifts recorded in this period. Staff clock in from their own view (Housekeeping / Maintenance).
        </p>
      ) : (
        <>
          {totals.suspectCount > 0 && (
            <p className="mx-4 mt-1 flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-[12px] text-warning-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {totals.suspectCount} shift{totals.suspectCount === 1 ? " has" : "s have"} been open for more than{" "}
                {SUSPECT_HOURS} hours — almost certainly a missed clock-out. They are excluded from the totals rather
                than guessed at.
              </span>
            </p>
          )}

          <div className="overflow-x-auto p-4">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  <th className="pb-2 pr-3 font-bold">Staff member</th>
                  <th className="pb-2 pr-3 font-bold">Worked as</th>
                  <th className="pb-2 pr-3 text-right font-bold">Days</th>
                  <th className="pb-2 pr-3 text-right font-bold">Shifts</th>
                  <th className="pb-2 text-right font-bold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} className="border-b border-surface-border/60 align-top last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-ink-900">{p.userName}</td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {p.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ")}
                    </td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-700">{p.days}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-700">
                      {p.sessions.length}
                      {p.openCount > 0 && (
                        <span className="ml-1 text-[11px] font-semibold text-warning-600">
                          ({p.openCount} open)
                        </span>
                      )}
                    </td>
                    <td className="tnum py-2.5 text-right font-semibold text-ink-900">
                      {formatMinutes(p.closedMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Said on the screen, not only in the schema. A table of hours worked is exactly the thing
              that gets forwarded to an accountant, and it is not built to carry that. */}
          <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
            An operational record of clock-ins, not a payroll or attendance system. Totals count closed shifts only.
          </p>
        </>
      )}
    </Card>
  );
}
