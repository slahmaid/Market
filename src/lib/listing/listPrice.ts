/** Prisma Int / Int32 ceiling — oversized asks must 400, not DB overflow. */
export const MAX_LIST_PRICE_CENTS = 2_147_483_647;

/** Reject empty/non-numeric input; Number.parseFloat would accept "12abc" as 12. */
export function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (cents < 1 || cents > MAX_LIST_PRICE_CENTS) return null;
  return cents;
}
