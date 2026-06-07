import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import { getUsageSummary } from "@/lib/usage";

export async function GET() {
  try {
    const summary = await getUsageSummary();

    return NextResponse.json(summary);
  } catch (error) {
    const clientError = toClientError(error, "Failed to load usage statistics.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
