import { NextResponse } from "next/server";
import { searchMarketplace } from "@/lib/search/searchMarketplace";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const result = await searchMarketplace(q);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
