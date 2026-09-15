import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const asBuyer = await prisma.conversation.findMany({
      where: { buyerId: userId },
      include: {
        store: { select: { name: true, squareId: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const asOwner = await prisma.conversation.findMany({
      where: {
        store: { square: { ownerId: userId } },
      },
      include: {
        store: { select: { name: true, squareId: true } },
        buyer: { select: { email: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const buyerItems = asBuyer.map((c) => ({
      id: c.id,
      role: "buyer" as const,
      storeName: c.store.name,
      squareId: c.store.squareId,
      peerLabel: c.store.name,
      status: c.status,
      updatedAt: c.updatedAt.toISOString(),
      lastMessagePreview: c.messages[0]?.body?.slice(0, 120) ?? null,
    }));

    const ownerItems = asOwner
      .filter((c) => c.buyerId !== userId)
      .map((c) => ({
        id: c.id,
        role: "owner" as const,
        storeName: c.store.name,
        squareId: c.store.squareId,
        peerLabel: c.buyer.email,
        status: c.status,
        updatedAt: c.updatedAt.toISOString(),
        lastMessagePreview: c.messages[0]?.body?.slice(0, 120) ?? null,
      }));

    const conversations = [...buyerItems, ...ownerItems].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );

    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
