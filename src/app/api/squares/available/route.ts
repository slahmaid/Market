import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { paginateAvailableSquares } from "@/lib/squares/availableSquares";

function parseIntParam(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseIntParam(url.searchParams.get("limit"), 50);
  const offset = parseIntParam(url.searchParams.get("offset"), 0);

  try {
    const rows = await prisma.square.findMany({
      where: { status: "platform" },
      select: { id: true, x: true, y: true },
    });

    const page = paginateAvailableSquares(rows, { limit, offset });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
