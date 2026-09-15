import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/chat/rateLimit";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ squareId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { squareId } = await params;

  const store = await prisma.store.findUnique({
    where: { squareId },
    select: {
      id: true,
      square: { select: { ownerId: true } },
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (store.square.ownerId === userId) {
    return NextResponse.json(
      { error: "Cannot message your own store" },
      { status: 403 },
    );
  }

  const existing = await prisma.conversation.findUnique({
    where: {
      storeId_buyerId: { storeId: store.id, buyerId: userId },
    },
  });

  if (existing) {
    return NextResponse.json({
      conversation: {
        id: existing.id,
        storeId: existing.storeId,
        buyerId: existing.buyerId,
        status: existing.status,
        updatedAt: existing.updatedAt.toISOString(),
      },
    });
  }

  if (!checkRateLimit(`convo:${userId}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many conversations" }, { status: 429 });
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        storeId: store.id,
        buyerId: userId,
      },
    });
    return NextResponse.json(
      {
        conversation: {
          id: conversation.id,
          storeId: conversation.storeId,
          buyerId: conversation.buyerId,
          status: conversation.status,
          updatedAt: conversation.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
