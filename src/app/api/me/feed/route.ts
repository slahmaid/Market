import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type FeedItemDto = {
  id: string;
  type: "sale" | "listing";
  title: string;
  subtitle: string;
  createdAt: string;
  squareId: string | null;
  accent: string;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Real activity only: the user's purchases/sales + their current listings.
 * Ads / offers are omitted until those features exist.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [transactions, listed] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
        },
        select: {
          id: true,
          type: true,
          amountCents: true,
          buyerId: true,
          sellerId: true,
          createdAt: true,
          square: { select: { id: true, x: true, y: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.square.findMany({
        where: { ownerId: userId, status: "listed" },
        select: {
          id: true,
          x: true,
          y: true,
          listPriceCents: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);

    const items: FeedItemDto[] = [];

    for (const tx of transactions) {
      const coords = `(${tx.square.x}, ${tx.square.y})`;
      const amount = formatUsd(tx.amountCents);
      const isBuyer = tx.buyerId === userId;
      const kind =
        tx.type === "primary"
          ? "Primary"
          : "Secondary";

      items.push({
        id: `tx:${tx.id}`,
        type: "sale",
        title: isBuyer
          ? `You bought square ${coords}`
          : `Your square ${coords} sold`,
        subtitle: `${kind} · ${amount}`,
        createdAt: tx.createdAt.toISOString(),
        squareId: tx.square.id,
        accent: isBuyer ? "#a7f3d0" : "#86efac",
      });
    }

    for (const sq of listed) {
      const coords = `(${sq.x}, ${sq.y})`;
      const ask =
        sq.listPriceCents != null ? formatUsd(sq.listPriceCents) : "no ask set";
      items.push({
        id: `listing:${sq.id}`,
        type: "listing",
        title: `You listed ${coords}`,
        subtitle: `Ask ${ask} · visible on the market`,
        createdAt: sq.updatedAt.toISOString(),
        squareId: sq.id,
        accent: "#c7d2fe",
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
