import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function tokenFromPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const submittedPassword = typeof password === "string" ? password.trim() : "";
    const APP_PASSWORD = process.env.APP_PASSWORD?.trim();

    if (!APP_PASSWORD) {
      console.error("FATAL: APP_PASSWORD is not set in environment variables.");
      return NextResponse.json(
        { error: "Authentication is not configured properly." },
        { status: 500 }
      );
    }

    if (submittedPassword === APP_PASSWORD) {
      const cookieStore = await cookies();

      cookieStore.set("auth-token", tokenFromPassword(APP_PASSWORD), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid password. Please try again." },
      { status: 401 }
    );
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth-token");
  const APP_PASSWORD = process.env.APP_PASSWORD?.trim();

  if (APP_PASSWORD && authToken?.value === tokenFromPassword(APP_PASSWORD)) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// Logout route
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  return NextResponse.json({ success: true });
}
