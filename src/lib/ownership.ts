import { Prisma } from "@prisma/client";
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

function isSessionUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("stripeCheckoutSessionId")
  );
}

/**
 * Atomically assign a platform square to the buyer and record a primary Transaction.
 * Uses conditional updateMany so a concurrent sale cannot double-assign.
 * Same checkout session is idempotent (including P2002 on session id).
 */
export async function completePrimaryPurchase(
  input: CompletePrimaryPurchaseInput,
): Promise<CompletePrimaryPurchaseResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({
      where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    });
    if (existing) {
      return { ok: true };
    }

    const updated = await tx.square.updateMany({
      where: { id: input.squareId, status: "platform" },
      data: { status: "owned", ownerId: input.buyerId },
    });

    if (updated.count === 0) {
      const settled = await tx.transaction.findUnique({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      });
      if (settled) {
        return { ok: true };
      }
      return { ok: false, reason: "not_buyable" };
    }

    try {
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
    } catch (error) {
      if (isSessionUniqueViolation(error)) {
        return { ok: true };
      }
      throw error;
    }

    return { ok: true };
  });
}
