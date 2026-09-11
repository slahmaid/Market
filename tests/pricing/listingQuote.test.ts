import { describe, expect, it } from "vitest";
import { buildListingQuote } from "@/lib/pricing/quoteSquare";
import { buildPlatformQuote } from "@/lib/pricing/quoteSquare";

describe("buildListingQuote", () => {
  it("uses list price as ask and classifies vs suggested", () => {
    const platform = buildPlatformQuote({ x: 24, y: 24 });
    const fairAsk = platform.suggestedPriceCents;
    const q = buildListingQuote({
      x: 24,
      y: 24,
      listPriceCents: fairAsk,
    });
    expect(q.askCents).toBe(fairAsk);
    expect(q.suggestedPriceCents).toBe(platform.suggestedPriceCents);
    expect(q.label).toBe("fair");
  });

  it("marks clearly high asks as unfair", () => {
    const platform = buildPlatformQuote({ x: 0, y: 0 });
    const high = Math.round(platform.suggestedPriceCents * 2);
    const q = buildListingQuote({
      x: 0,
      y: 0,
      listPriceCents: high,
    });
    expect(q.label).toBe("unfair");
    expect(q.askCents).toBe(high);
  });
});
