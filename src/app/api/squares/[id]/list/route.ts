import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCanList } from "@/lib/listing";
import { buildListingQuote } from "@/lib/pricing";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  listPriceCents: z.number().int().min(1),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "listPriceCents must be an integer ≥ 1" },
      { status: 400 },
    );
  }

  try {
    const square = await prisma.square.findUnique({ where: { id } });
    if (!square) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
      assertCanList(
        { status: square.status, ownerId: square.ownerId },
        session.user.id,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cannot list";
      const status = /owner/i.test(msg) ? 403 : 409;
      return NextResponse.json({ error: msg }, { status });
    }

    const updated = await prisma.square.update({
      where: { id },
      data: {
        status: "listed",
        listPriceCents: body.listPriceCents,
      },
    });
    const quote = buildListingQuote({
      x: updated.x,
      y: updated.y,
      listPriceCents: body.listPriceCents,
    });
    return NextResponse.json({
      square: {
        id: updated.id,
        x: updated.x,
        y: updated.y,
        status: updated.status,
        imageUrl: updated.imageUrl,
        linkUrl: updated.linkUrl,
        listPriceCents: updated.listPriceCents,
        ownerId: updated.ownerId,
      },
      quote,
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
