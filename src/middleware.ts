import { NextResponse, type NextRequest } from "next/server";

/**
 * "Keep me signed in" — the opt-out half.
 *
 * Auth.js sets one session lifetime for the whole app (90 days, see auth.ts),
 * so a per-login choice has to be applied to the cookie itself. When someone
 * unticks the box at sign-in we set `cr.persist=0`, and this re-issues the
 * session cookie with no Max-Age or Expires, which makes it a browser-session
 * cookie: closing the browser signs them out. Everyone else keeps the 90 days.
 *
 * The token is re-emitted on every matched response rather than once at
 * sign-in, so it stays a session cookie even after Auth.js rolls it on its
 * daily `updateAge` refresh.
 */

const PERSIST_COOKIE = "cr.persist";

// Auth.js chunks the token across `.0`, `.1`, … when it outgrows 4 KB, and
// prefixes it with __Secure- over HTTPS. Match every shape.
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (request.cookies.get(PERSIST_COOKIE)?.value !== "0") return response;

  const secure = request.nextUrl.protocol === "https:";
  for (const cookie of request.cookies.getAll()) {
    if (!SESSION_COOKIE.test(cookie.name)) continue;
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      // Deliberately no maxAge/expires — that is what makes it session-scoped.
    });
  }

  return response;
}

export const config = {
  // /api/auth is excluded: Auth.js writes its own Set-Cookie headers on those
  // routes and two writers on one response is a race worth not having.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
