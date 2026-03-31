import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define which paths should be protected
  const isAppPath = pathname.startsWith("/app");
  
  // Check for the auth-token cookie
  const authToken = request.cookies.get("auth-token");

  if (isAppPath) {
    if (!authToken) {
      console.log("Middleware: No auth-token found for", pathname, "- Redirecting to /login");
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    } else {
      console.log("Middleware: Valid auth-token detected for", pathname);
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ["/app/:path*"],
};
