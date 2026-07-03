import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getInventoryBoard, getProperty, todayInTz } from "@/lib/data";
import { getCancellationReport, getPickupReport, getRangeMetrics, resolveRange } from "@/lib/metrics";

/** CSV export for every report — the SAME data functions the screens render (one formula sheet).
 *  Excel/PDF variants are a future addition per the spec; CSV covers V1. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const report = sp.get("report") ?? "performance";
  const property = await getProperty();
  const todayIso = todayInTz(property.timezone);
  const range = resolveRange(todayIso, sp.get("range") ?? "30d", sp.get("from") ?? undefined, sp.get("to") ?? undefined);

  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
  const moneyCol = (minor: number) => (minor / 100).toFixed(2);

  let body = "";
  if (report === "pickup") {
    const r = await getPickupReport();
    body = csv([
      ["stay_date", "sold_now", `sold_at_snapshot_${r.vsDate ?? "none"}`, "pickup"],
      ...r.rows.map((row) => [row.date, row.soldNow, row.soldAtSnap, row.pickup]),
    ]);
  } else if (report === "source") {
    const m = await getRangeMetrics(range);
    body = csv([
      ["source", "reservations", "room_nights", `revenue_${property.baseCurrency}`, "share_pct"],
      ...m.sourceMix.map((s) => [s.name, s.reservations, s.roomNights, moneyCol(s.revenueMinor), s.sharePct.toFixed(1)]),
    ]);
  } else if (report === "cancellation") {
    const r = await getCancellationReport(range);
    body = csv([
      ["guest", "check_in", "check_out", "room_type", "source", `total_${property.baseCurrency}`, "cancelled_at"],
      ...r.cancelled.map((res) => {
        const line = res.lines[0];
        return [
          res.guestName,
          line?.checkIn.toISOString().slice(0, 10) ?? "",
          line?.checkOut.toISOString().slice(0, 10) ?? "",
          line?.roomType.name ?? "",
          res.channel?.name ?? res.bookingSource?.name ?? "Direct",
          moneyCol(res.totalMinor),
          res.cancelledAt?.toISOString().slice(0, 10) ?? "",
        ];
      }),
    ]);
  } else if (report === "availability") {
    const board = await getInventoryBoard({ days: 30 });
    body = csv([
      ["room_type", ...board.dates],
      ...board.sections.map((s) => [s.roomType.name, ...s.cells.map((c) => c.remaining)]),
    ]);
  } else {
    const m = await getRangeMetrics(range);
    body = csv([
      ["date", "available_room_nights", "rooms_sold", "occupancy_pct", `revenue_${m.cards.revenueDisplay}_${property.baseCurrency}`],
      ...m.perDay.map((d) => [d.date, d.available, d.soldNights, d.occupancyPct.toFixed(1), moneyCol(d.revenueMinor)]),
    ]);
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revio-${report}-${range.start}.csv"`,
    },
  });
}
