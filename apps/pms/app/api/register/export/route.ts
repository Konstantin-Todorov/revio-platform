import { NextResponse, type NextRequest } from "next/server";
import { registerToCsv } from "@revio/core";
import { roleHasCapability } from "@/lib/roles";
import { activeProperty } from "@/lib/data";
import { getRegisterEntries } from "@/lib/register";
import { todayInTz } from "@/lib/format";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The register as the official образец, for upload to ЕСТИ.
 *
 * Gated on `frontDesk` and not merely on being signed in: this file is every identity document the
 * property holds for the month, in one download. It is the single most sensitive response the PMS
 * can produce.
 */
export async function GET(req: NextRequest) {
  const { session, property } = await activeProperty();
  if (!roleHasCapability(session.role, "frontDesk")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const today = todayInTz(property.timezone);
  const sp = req.nextUrl.searchParams;
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : `${today.slice(0, 7)}-01`;
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today;

  const entries = await getRegisterEntries(property.id, property.timezone, from, to);

  /*
   * A UTF-8 byte-order mark, and it is not optional.
   *
   * Excel on Windows reads a .csv as the machine's ANSI codepage unless a BOM says otherwise, and
   * every Cyrillic name in the file comes out as mojibake. The register is only ever opened in
   * Excel, so the file that opens correctly there is the only one that works.
   */
  const body = "﻿" + registerToCsv(entries);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registar-nastaneni-turisti-${from}-${to}.csv"`,
      // Never cached, anywhere. This is a file of identity documents.
      "Cache-Control": "no-store, private",
    },
  });
}
