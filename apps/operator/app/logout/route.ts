import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Clears the session cookie and returns to /login. Used when a cookie is present but the session is
// invalid (e.g. the operator user was removed by a re-seed) — redirecting straight to /login would loop,
// because the middleware bounces a cookie-bearing /login back to /overview. Deleting the cookie breaks it.
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
