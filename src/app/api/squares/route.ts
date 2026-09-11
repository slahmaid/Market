import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listPreviewSquares } from "@/lib/previewBoard";

const PREVIEW = () =>
  NextResponse.json({
    squares: listPreviewSquares(),
    preview: true,
  });

export async function GET() {
  if (process.env.PREVIEW_NO_DB === "1") {
    return PREVIEW();
  }

  try {
    const squares = await Promise.race([
      prisma.square.findMany({
        select: {
          id: true,
          x: true,
          y: true,
          status: true,
          imageUrl: true,
          listPriceCents: true,
        },
        orderBy: [{ y: "asc" }, { x: "asc" }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db-timeout")), 1500),
      ),
    ]);

    if (squares.length === 0) {
      return PREVIEW();
    }
    return NextResponse.json({ squares });
  } catch {
    return PREVIEW();
  }
}
