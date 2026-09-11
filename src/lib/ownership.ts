import { prisma } from "@/lib/db";

export type SquareBuySnapshot = {
  status: "platform" | "owned" | "listed";
  ownerId: string | null;
};

export function assertSquareBuyable(
  square: SquareBuySnapshot,
  _buyerId: string,
): void {
  if (square.status === "owned") {
    throw new Error("Square is already owned");
  }
  if (square.status !== "platform" || square.ownerId) {
    throw new Error("Square is not available for primary purchase");
  }
}

export type CompletePrimaryPurchaseInput = {
  squareId: string;
  buyerId: string;
  amountCents: number;
  stripeCheckoutSessionId: string;
};

export type CompletePrimaryPurchaseResult =
  | { ok: true }
  | { ok: false; reason: "not_buyable" };

/**
 * Atomically assign a platform square to the buyer and record a primary Transaction.
 * Uses conditional updateMany so a concurrent sale cannot double-assign.
 */
export async function completePrimaryPurchase(
  input: CompletePrimaryPurchaseInput,
): Promise<CompletePrimaryPurchaseResult> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.square.updateMany({
      where: { id: input.squareId, status: "platform" },
      data: { status: "owned", ownerId: input.buyerId },
    });

    if (updated.count === 0) {
      return { ok: false, reason: "not_buyable" };
    }

    await tx.transaction.create({
      data: {
        squareId: input.squareId,
        buyerId: input.buyerId,
        sellerId: null,
        amountCents: input.amountCents,
        feeCents: 0,
        type: "primary",
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      },
    });

    return { ok: true };
  });
}
