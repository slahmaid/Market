import { describe, expect, it } from "vitest";
import { buildPlatformQuote } from "@/lib/pricing/quoteSquare";

describe("buildPlatformQuote", () => {
  it("uses location price as ask for platform square", () => {
    const q = buildPlatformQuote({ x: 24, y: 24 });
    expect(q.askCents).toBe(q.suggestedPriceCents);
    expect(q.label).toBe("fair");
  });

  it("corner ask near $5", () => {
    const q = buildPlatformQuote({ x: 0, y: 0 });
    expect(q.askCents).toBeGreaterThanOrEqual(500);
    expect(q.askCents).toBeLessThanOrEqual(800);
  });

  it("applies multiplier when provided", () => {
    const base = buildPlatformQuote({ x: 10, y: 10 });
    const hot = buildPlatformQuote({ x: 10, y: 10, multipliers: { neighbor: 1.2 } });
    expect(hot.suggestedPriceCents).toBe(Math.round(base.suggestedPriceCents * 1.2));
  });
});
