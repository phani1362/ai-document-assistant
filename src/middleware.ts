import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define which paths should be protected
  const isAppPath = pathname.startsWith("/app");
  
  // Check for the auth-token cookie
  const authToken = request.cookies.get("auth-token");

  // If trying to access /app without a valid cookie, redirect to /login
  if (isAppPath && !authToken) {
    const loginUrl = new URL("/login", request.url);
    // Optional: Pass the original URL to redirect back after login
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ["/app/:path*"],
};
