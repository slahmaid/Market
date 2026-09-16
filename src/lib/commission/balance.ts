import { prisma } from "@/lib/db";

export const MIN_COMMISSION_CHECKOUT_CENTS = 50;
export const PENDING_CHECKOUT_GUARD_MS = 60 * 60 * 1000;

export function computeUnpaidCents(
  lifetimeFeesCents: number,
  paidCents: number,
): number {
  return Math.max(0, lifetimeFeesCents - paidCents);
}

export function canPayCommission(unpaidCents: number): boolean {
  return unpaidCents >= MIN_COMMISSION_CHECKOUT_CENTS;
}

export async function getStoreCommissionBalance(storeId: string): Promise<{
  lifetimeFeesCents: number;
  paidCents: number;
  unpaidCents: number;
  canPayCommission: boolean;
}> {
  const [feeAgg, paidAgg] = await Promise.all([
    prisma.productClick.aggregate({
      where: { storeId },
      _sum: { feeCents: true },
    }),
    prisma.commissionPayment.aggregate({
      where: { storeId, status: "succeeded" },
      _sum: { amountCents: true },
    }),
  ]);
  const lifetimeFeesCents = feeAgg._sum.feeCents ?? 0;
  const paidCents = paidAgg._sum.amountCents ?? 0;
  const unpaidCents = computeUnpaidCents(lifetimeFeesCents, paidCents);
  return {
    lifetimeFeesCents,
    paidCents,
    unpaidCents,
    canPayCommission: canPayCommission(unpaidCents),
  };
}
