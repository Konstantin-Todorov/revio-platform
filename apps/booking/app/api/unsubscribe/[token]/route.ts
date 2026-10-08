import { NextResponse, type NextRequest } from "next/server";
import { guestByPrefsToken, setMarketingOptOut } from "@/lib/email-prefs";

/**
 * RFC 8058 one-click unsubscribe — the target of the `List-Unsubscribe` header on a hotel's
 * promotional guest email. Gmail and Yahoo show their own "Unsubscribe" button for it and POST
 * `List-Unsubscribe=One-Click` here; there is no page and no second click.
 *
 * POST only. The RFC requires it precisely so a scanner fetching the URL cannot unsubscribe anyone.
 * An unknown token answers 200 as well: the mail client cannot do anything useful with an error, and
 * a different status would tell a prober which tokens exist.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await guestByPrefsToken(token);
  if (guest) await setMarketingOptOut(guest, true);
  return new NextResponse(null, { status: 200 });
}
