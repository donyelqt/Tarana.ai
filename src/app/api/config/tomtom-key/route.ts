import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiKey = process.env.TOMTOM_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "TomTom API key not configured" }, { status: 503 });
  }

  return NextResponse.json({ key: apiKey }, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
