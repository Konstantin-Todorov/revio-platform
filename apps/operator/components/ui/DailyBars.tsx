/**
 * Thirty days of "was anybody there", as a column per day.
 *
 * ## Why bars and not a line
 *
 * A line interpolates. Between Friday's 9 people and Monday's 8 it draws a weekend that never
 * happened, and a hotel that came in twice all month gets a smooth slope suggesting it tapered off.
 * Columns state each day as its own reading and let the gaps be gaps — which, on a chart whose whole
 * job is spotting a hotel that stopped, is the difference between seeing it and not.
 *
 * ## What is emphasised
 *
 * Weekends are drawn lighter. A front desk works seven days and an owner does not, so a Saturday
 * trough is normal and a Tuesday trough is not — without that distinction every week looks like a
 * decline followed by a recovery.
 */
export function DailyBars({
  series,
  height = 92,
}: {
  series: { day: string; people: number; views: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...series.map((d) => d.people));
  const isWeekend = (iso: string) => {
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return dow === 0 || dow === 6;
  };

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img"
        aria-label={`Active people per day over ${series.length} days, peaking at ${max}`}>
        {series.map((d) => {
          const h = (d.people / max) * 100;
          return (
            <div
              key={d.day}
              title={`${d.day} · ${d.people} ${d.people === 1 ? "person" : "people"} · ${d.views} screens`}
              className="flex-1 rounded-t-[2px] transition-[height]"
              style={{
                // A day with nobody still gets a visible sliver, so the axis reads as thirty days
                // rather than as a chart that starts wherever the data does.
                height: `${Math.max(h, d.people > 0 ? 6 : 2)}%`,
                background: d.people === 0 ? "#e7eaef" : isWeekend(d.day) ? "#9aa3b1" : "#1d4ea0",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-ink-400">
        <span>{series[0]?.day.slice(5)}</span>
        <span>peak {max}</span>
        <span>{series.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  );
}
