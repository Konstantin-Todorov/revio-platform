import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Clears the session cookie and returns to /login. Used when a cookie is present but the session is
// invalid (e.g. the operator user was removed by a re-seed) — redirecting straight to /login would loop,
// because the middleware bounces a cookie-bearing /login back to /overview. Deleting the cookie breaks it.
//
// Use a RELATIVE Location (not new URL(..., req.url)): behind Railway's proxy req.url is the internal
// host (localhost:8080), so an absolute redirect would send the browser to the wrong host.
export async function GET() {
  const res = new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
