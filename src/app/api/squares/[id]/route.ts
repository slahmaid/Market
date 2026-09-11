import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildListingQuote, buildPlatformQuote } from "@/lib/pricing";
import { getPreviewSquareDetail } from "@/lib/previewBoard";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const preview = getPreviewSquareDetail(id);
  if (preview) {
    return NextResponse.json(preview);
  }

  try {
    const square = await prisma.square.findUnique({ where: { id } });
    if (!square) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const quote =
      square.status === "listed" && square.listPriceCents != null
        ? buildListingQuote({
            x: square.x,
            y: square.y,
            listPriceCents: square.listPriceCents,
          })
        : buildPlatformQuote({ x: square.x, y: square.y });

    return NextResponse.json({
      square: {
        id: square.id,
        x: square.x,
        y: square.y,
        status: square.status,
        imageUrl: square.imageUrl,
        linkUrl: square.linkUrl,
        listPriceCents: square.listPriceCents,
        ownerId: square.ownerId,
      },
      quote: {
        askCents: quote.askCents,
        suggestedPriceCents: quote.suggestedPriceCents,
        label: quote.label,
        reason: quote.reason,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
