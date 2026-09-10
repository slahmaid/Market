import { describe, expect, it } from "vitest";
import { classifyPrice } from "@/lib/pricing/priceComment";

describe("classifyPrice", () => {
  it("marks within 10% as fair", () => {
    const r = classifyPrice(10000, 10000);
    expect(r.label).toBe("fair");
  });

  it("marks 15% over as balanced", () => {
    const r = classifyPrice(11500, 10000);
    expect(r.label).toBe("balanced");
  });

  it("marks 30% over as unfair", () => {
    const r = classifyPrice(13000, 10000);
    expect(r.label).toBe("unfair");
  });

  it("marks 30% under as unfair", () => {
    const r = classifyPrice(7000, 10000);
    expect(r.label).toBe("unfair");
  });

  it("includes a non-empty reason", () => {
    expect(classifyPrice(10000, 10000).reason.length).toBeGreaterThan(0);
  });
});
