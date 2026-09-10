import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPlatformQuote } from "@/lib/pricing";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const square = await prisma.square.findUnique({ where: { id } });
  if (!square) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = buildPlatformQuote({ x: square.x, y: square.y });

  await prisma.priceQuote.upsert({
    where: { squareId: square.id },
    create: {
      squareId: square.id,
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
    },
    update: {
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
      computedAt: new Date(),
    },
  });

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
}
