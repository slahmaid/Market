import { describe, expect, it, vi, beforeEach } from "vitest";

const mockProductFindUnique = vi.fn();
const mockClickCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => mockProductFindUnique(...args),
    },
    productClick: {
      create: (...args: unknown[]) => mockClickCreate(...args),
    },
  },
}));

import { GET } from "@/app/go/[productId]/route";

const params = Promise.resolve({ productId: "prod1" });

describe("GET /go/[productId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("302 redirects and logs click for active https product", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod1",
      active: true,
      buyUrl: "https://example.com/item",
      storeId: "st1",
    });
    mockClickCreate.mockResolvedValue({ id: "c1" });

    const res = await GET(new Request("http://localhost/go/prod1"), { params });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/item");
    expect(mockClickCreate).toHaveBeenCalledWith({
      data: { productId: "prod1", storeId: "st1" },
    });
  });

  it("404 when product inactive", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod1",
      active: false,
      buyUrl: "https://example.com/item",
      storeId: "st1",
    });

    const res = await GET(new Request("http://localhost/go/prod1"), { params });
    expect(res.status).toBe(404);
    expect(mockClickCreate).not.toHaveBeenCalled();
  });

  it("404 when buyUrl missing", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod1",
      active: true,
      buyUrl: null,
      storeId: "st1",
    });

    const res = await GET(new Request("http://localhost/go/prod1"), { params });
    expect(res.status).toBe(404);
    expect(mockClickCreate).not.toHaveBeenCalled();
  });

  it("still 302 when click create fails", async () => {
    mockProductFindUnique.mockResolvedValue({
      id: "prod1",
      active: true,
      buyUrl: "https://example.com/item",
      storeId: "st1",
    });
    mockClickCreate.mockRejectedValue(new Error("db down"));

    const res = await GET(new Request("http://localhost/go/prod1"), { params });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/item");
  });
});
