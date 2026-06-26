import { NextResponse, type NextRequest } from "next/server";

// Operator uses its OWN cookie so it never collides with a hotel session (same host, different app).
const SESSION_COOKIE = "revio_op_session";

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
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
