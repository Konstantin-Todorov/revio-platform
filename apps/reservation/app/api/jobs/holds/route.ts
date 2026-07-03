import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";
import { releaseExpiredHolds } from "@/lib/holds";

/** Scheduled entry point for hold expiry (all tenants). Lazy page-load runs cover the demo;
 *  this route is the every-few-minutes cron when real traffic arrives. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const released = await releaseExpiredHolds(forSystem());
  return NextResponse.json({ ok: true, released });
}
