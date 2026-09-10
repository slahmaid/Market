import { describe, expect, it } from "vitest";
import { baseLocationPriceCents } from "@/lib/pricing/locationPrice";

describe("baseLocationPriceCents", () => {
  it("prices dead center near $100", () => {
    // cells (24,24), (24,25), (25,24), (25,25) are closest to 24.5,24.5
    const p = baseLocationPriceCents(24, 24);
    expect(p).toBeGreaterThanOrEqual(9500);
    expect(p).toBeLessThanOrEqual(10000);
  });

  it("prices a corner near $5", () => {
    const p = baseLocationPriceCents(0, 0);
    expect(p).toBeGreaterThanOrEqual(500);
    expect(p).toBeLessThanOrEqual(800);
  });

  it("prices an edge midpoint near $5", () => {
    const p = baseLocationPriceCents(0, 25);
    expect(p).toBeGreaterThanOrEqual(500);
    expect(p).toBeLessThanOrEqual(800);
  });

  it("returns integer cents", () => {
    expect(Number.isInteger(baseLocationPriceCents(10, 10))).toBe(true);
  });
});
