import { describe, expect, it, vi, beforeEach } from "vitest";

const mockQueryRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { searchMarketplace } from "@/lib/search/searchMarketplace";
import { GET } from "@/app/api/search/route";

describe("searchMarketplace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty for short query without hitting db", async () => {
    const result = await searchMarketplace("a");
    expect(result).toEqual({ stores: [], products: [] });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("maps store and product rows", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: "st1",
          squareId: "sq1",
          name: "Corner Café",
          about: "Fresh coffee",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "Latte",
          priceCents: 450,
          storeId: "st1",
          squareId: "sq1",
          storeName: "Corner Café",
          imageUrl: null,
        },
      ]);

    const result = await searchMarketplace("cafe");
    expect(result.stores).toHaveLength(1);
    expect(result.products[0].name).toBe("Latte");
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty arrays for short q", async () => {
    const res = await GET(new Request("http://localhost/api/search?q=x"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ stores: [], products: [] });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
