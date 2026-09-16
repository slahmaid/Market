export const DEFAULT_COMMISSION_FEE_BPS = 700;

export function computeClickFeeCents(
  priceCents: number,
  feeBps: number,
): number {
  return Math.floor((priceCents * feeBps) / 10000);
}

export function getCommissionFeeBps(): number {
  const raw = process.env.COMMISSION_FEE_BPS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_COMMISSION_FEE_BPS;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return DEFAULT_COMMISSION_FEE_BPS;
  }
  return n;
}
