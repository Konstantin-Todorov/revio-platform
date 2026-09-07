import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Where a browser crash is filed.
 *
 * The error log saw only the server. A component that threw in the browser showed an apology and
 * told us nothing — we would find out when a hotel telephoned, which is the detection mechanism the
 * error log exists to replace.
 *
 * ## It cannot be used to flood the table
 *
 * `recordAppError` aggregates by signature, so a thousand reports of one bug are one row with a
 * count of a thousand. That is the whole protection and it needs no rate limiter: the cost of a
 * flood is a counter going up, not a table filling. The message and stack are also capped both here
 * and in the browser.
 *
 * Behind the session cookie like every other route in the app — an unauthenticated POST is
 * redirected by middleware before it arrives, so this is not an open endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: unknown; stack?: unknown; route?: unknown; digest?: unknown };
    const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";
    if (!message) return NextResponse.json({ ok: true });

    const { recordAppError } = await import("@revio/db/errors");
    // Rebuilt as an Error so the signature is computed the same way as a server fault — one bug
    // reported from both sides must be one row, not two.
    const err = new Error(message);
    err.stack = typeof body.stack === "string" ? body.stack.slice(0, 4000) : undefined;

    await recordAppError({
      service: "operator",
      error: err,
      route: typeof body.route === "string" ? `${body.route} (browser)` : "(browser)",
    });
  } catch {
    /* a reporter that fails must never itself report a failure */
  }
  // Always 200: the browser has nothing useful to do with a rejection, and the page is usually
  // already reloading.
  return NextResponse.json({ ok: true });
}
