import { describe, expect, it } from "vitest";
import { buildPlatformQuote } from "@/lib/pricing";
import { paginateAvailableSquares } from "@/lib/squares/availableSquares";

describe("paginateAvailableSquares", () => {
  it("sorts by askCents ascending and paginates", () => {
    const rows = [
      { id: "center", x: 24, y: 24 },
      { id: "corner", x: 0, y: 0 },
      { id: "edge", x: 0, y: 24 },
    ];

    const page = paginateAvailableSquares(rows, { limit: 2, offset: 0 });

    expect(page.squares).toHaveLength(2);
    expect(page.squares[0]!.id).toBe("corner");
    expect(page.squares[0]!.askCents).toBe(
      buildPlatformQuote({ x: 0, y: 0 }).askCents,
    );
    expect(page.squares[1]!.askCents).toBeLessThanOrEqual(
      buildPlatformQuote({ x: 24, y: 24 }).askCents,
    );
    expect(page.nextOffset).toBe(2);
  });

  it("returns null nextOffset on last page", () => {
    const rows = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1, y: 0 },
    ];
    const page = paginateAvailableSquares(rows, { limit: 50, offset: 0 });
    expect(page.squares).toHaveLength(2);
    expect(page.nextOffset).toBeNull();
  });
});
