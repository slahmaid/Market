import { baseLocationPriceCents } from "./locationPrice";
import { classifyPrice, type PriceLabelName } from "./priceComment";

export type QuoteMultipliers = {
  neighbor?: number;
  velocity?: number;
  scarcity?: number;
  competition?: number;
  timeDecay?: number;
  liquidity?: number;
};

export type PlatformQuote = {
  suggestedPriceCents: number;
  askCents: number;
  label: PriceLabelName;
  reason: string;
};

function product(m: QuoteMultipliers | undefined): number {
  if (!m) return 1;
  return (
    (m.neighbor ?? 1) *
    (m.velocity ?? 1) *
    (m.scarcity ?? 1) *
    (m.competition ?? 1) *
    (m.timeDecay ?? 1) *
    (m.liquidity ?? 1)
  );
}

export function buildPlatformQuote(input: {
  x: number;
  y: number;
  multipliers?: QuoteMultipliers;
}): PlatformQuote {
  const base = baseLocationPriceCents(input.x, input.y);
  const suggestedPriceCents = Math.max(100, Math.round(base * product(input.multipliers)));
  const askCents = suggestedPriceCents; // Phase 1: platform ask = suggestion
  const { label, reason } = classifyPrice(askCents, suggestedPriceCents);
  return { suggestedPriceCents, askCents, label, reason };
}
