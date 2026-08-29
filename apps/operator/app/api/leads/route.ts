import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";

/**
 * Where a website demo request is filed.
 *
 * The marketing site is a separate repository and a separate service with no database of its own, so
 * it emails the office and then posts here. This is the row that makes a lead findable after the
 * email has been read on a phone and forgotten.
 *
 * ## Why a shared secret and not a session
 *
 * The caller is a server, not a person — there is no session to carry. A constant-time comparison
 * against `LEADS_INGEST_SECRET`, and the endpoint does nothing at all if the secret is unset: an
 * unauthenticated write path into an operator table is worse than a missing feature, and a
 * misconfigured deploy must fail closed.
 *
 * ## Why `forSystem()` is correct here
 *
 * `Lead` is `operator_only` — ours about a prospect, never a hotel's own data — and this request has
 * no tenant and never could. This is one of the few paths the perimeter exists FOR, unlike a
 * hotel-facing request where it would be a breach. See AGENTS.md §1.
 */

export const dynamic = "force-dynamic";

/** Length-independent comparison, so a wrong secret cannot be narrowed by timing. */
function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const str = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  const expected = process.env.LEADS_INGEST_SECRET?.trim();
  if (!expected) {
    // Fail closed. Never accept an unauthenticated write into an operator table.
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!secretMatches(req.headers.get("x-revio-ingest"), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const email = str(body.email, 320);
  if (!email) return NextResponse.json({ error: "email required" }, { status: 422 });

  const lead = await forSystem().lead.create({
    data: {
      // A submission with no name is still a lead. Recorded as unknown rather than refused.
      name: str(body.name, 200) ?? "—",
      email,
      company: str(body.company, 200),
      rooms: str(body.rooms, 100),
      currentSystem: str(body.currentSystem, 200),
      channels: str(body.channels, 500),
      interestedIn: str(body.interestedIn, 300),
      message: str(body.message, 5000),
      quote: str(body.quote, 100),
      page: str(body.page, 300),
      utmSource: str(body.utmSource, 200),
      utmMedium: str(body.utmMedium, 200),
      utmCampaign: str(body.utmCampaign, 200),
      referrer: str(body.referrer, 500),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
