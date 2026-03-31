import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public paths that never need protection
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isAppPath = pathname.startsWith("/app");
  const authToken = request.cookies.get("auth-token");

  // Only protect /app routes
  if (isAppPath && !authToken) {
    console.log(`Middleware: Redirecting ${pathname} to /login`);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/"],
};
