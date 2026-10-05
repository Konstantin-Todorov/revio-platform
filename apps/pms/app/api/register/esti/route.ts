import { NextResponse } from "next/server";
import { estiCsv, estiProblems, estiRow } from "@revio/core";
import { roleHasCapability } from "@/lib/roles";
import { activeProperty } from "@/lib/data";
import { getEstiPending } from "@/lib/register";
import { getConfiguration } from "@/lib/config";
import { todayInTz } from "@/lib/format";

/**
 * The ЕСТИ upload file: every registration ЕСТИ does not yet have in its current form.
 *
 * Downloading marks nothing. A file that was downloaded is not a file ЕСТИ accepted, so rows are
 * recorded as sent only when the desk confirms the upload on the register screen. Rows with a
 * missing required field are left out — ЕСТИ rejects a whole file for one bad row — and the
 * screen lists them so they can be completed.
 *
 * Gated on `frontDesk`: like the образец export, this is every identity document in one response.
 */
export async function GET() {
  const { session, property } = await activeProperty();
  if (!roleHasCapability(session.role, "frontDesk")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { defaults } = await getConfiguration();
  const uin = defaults?.estiPlaceUin ?? null;
  const today = todayInTz(property.timezone);
  const pending = await getEstiPending(property.id, property.timezone, today);
  const ready = pending.filter((p) => estiProblems(p.entry, uin).length === 0);
  const times = { checkIn: property.checkInTime ?? "14:00", checkOut: property.checkOutTime ?? "12:00" };
  const body = estiCsv(ready.map((p) => estiRow(p.entry, uin!, p.change, times)));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="esti-${today}.csv"`,
      "Cache-Control": "no-store, private",
    },
  });
}
