import { NextResponse, type NextRequest } from "next/server";

/**
 * "Proxy" de Next 16 (la convención que antes se llamaba middleware). NO es el proxy BFF hacia la
 * API, que está en `src/app/api/proxy/[...path]/route.ts`.
 *
 * Primera barrera, barata: sin cookie de sesión se redirige al login. La validación real la hace
 * el layout protegido con `GET /me`.
 */
export function proxy(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME?.trim() || "pqrs_session";
  if (!request.cookies.has(cookieName)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|login|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
