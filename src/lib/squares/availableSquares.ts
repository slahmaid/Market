import { buildPlatformQuote } from "@/lib/pricing";

export type AvailableSquareRow = {
  id: string;
  x: number;
  y: number;
};

export type AvailableSquare = AvailableSquareRow & {
  askCents: number;
};

export function paginateAvailableSquares(
  rows: AvailableSquareRow[],
  opts: { limit: number; offset: number },
): { squares: AvailableSquare[]; nextOffset: number | null } {
  const limit = Math.max(1, Math.min(100, Math.floor(opts.limit) || 50));
  const offset = Math.max(0, Math.floor(opts.offset) || 0);

  const ranked = rows
    .map((row) => ({
      ...row,
      askCents: buildPlatformQuote({ x: row.x, y: row.y }).askCents,
    }))
    .sort((a, b) => a.askCents - b.askCents || a.y - b.y || a.x - b.x);

  const squares = ranked.slice(offset, offset + limit);
  const next = offset + limit;
  return {
    squares,
    nextOffset: next < ranked.length ? next : null,
  };
}
