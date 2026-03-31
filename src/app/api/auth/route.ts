import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const APP_PASSWORD = process.env.APP_PASSWORD?.trim();

    console.log("Auth attempt received.");
    if (!APP_PASSWORD) {
      console.error("FATAL: APP_PASSWORD is not set in environment variables.");
      return NextResponse.json(
        { error: "Authentication is not configured properly." },
        { status: 500 }
      );
    }

    if (password === APP_PASSWORD) {
      console.log("Auth successful: Password matched.");
      const cookieStore = await cookies();
      
      // Set a secure, HTTP-only cookie
      cookieStore.set("auth-token", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 7 days
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

// Add a GET method to check if the user is authenticated (useful for client-side checks)
export async function GET() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth-token");

  if (authToken) {
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
