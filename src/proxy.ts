import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function getExpectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that never need protection
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const isAppPath = pathname.startsWith("/app");
  const authToken = request.cookies.get("auth-token");
  const APP_PASSWORD = process.env.APP_PASSWORD?.trim();

  if (isAppPath) {
    const redirectToLogin = () => {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    };

    if (!authToken || !APP_PASSWORD) return redirectToLogin();

    const expectedToken = await getExpectedToken(APP_PASSWORD);
    if (authToken.value !== expectedToken) return redirectToLogin();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/"],
};
