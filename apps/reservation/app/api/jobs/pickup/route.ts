import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";
import { ensurePickupSnapshot } from "@/lib/pickup";

/**
 * Scheduled entry point for the nightly pickup snapshot (all tenants — system perimeter).
 * The same job also runs lazily on Dashboard/Inventory loads, so this route is a safety net for
 * days nobody logs in. Gate: CRON_SECRET must be set and match the bearer token.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensurePickupSnapshot(forSystem());
  return NextResponse.json({ ok: true });
}
