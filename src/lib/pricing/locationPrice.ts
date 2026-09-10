import {
  CENTER,
  CENTER_PRICE_CENTS,
  EDGE_PRICE_CENTS,
  GRID_SIZE,
} from "./constants";

/**
 * Smooth falloff: center ≈ $100, edge/corner ≈ $5.
 * Uses normalized Chebyshev distance from (24.5, 24.5).
 */
export function baseLocationPriceCents(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
    throw new Error(`coords out of range: ${x},${y}`);
  }
  const d = Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER));
  const t = Math.min(1, Math.max(0, d / CENTER));
  // ease: keep center high longer, drop toward edges
  const eased = t * t;
  const price =
    CENTER_PRICE_CENTS -
    eased * (CENTER_PRICE_CENTS - EDGE_PRICE_CENTS);
  return Math.round(price);
}
