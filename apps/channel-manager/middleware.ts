import { NextResponse, type NextRequest } from "next/server";

// Edge-safe gate: redirect by session-cookie presence. Full validation happens in getSession (node).
const SESSION_COOKIE = "revio_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/login";
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // api/jobs does its own Bearer auth (cron) and api/brand serves a hotel's email logo to mail
  // clients that carry no session at all — the cookie gate must not redirect either.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/jobs|api/brand|.*\\.[a-zA-Z0-9]+$).*)"],
};
