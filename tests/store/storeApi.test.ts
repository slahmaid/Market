import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSquareFindUnique = vi.fn();
const mockStoreFindUnique = vi.fn();
const mockStoreUpsert = vi.fn();
const mockClickGroupBy = vi.fn();
const mockGetBalance = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/commission/balance", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/commission/balance")
  >("@/lib/commission/balance");
  return {
    ...actual,
    getStoreCommissionBalance: (...args: unknown[]) => mockGetBalance(...args),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    square: {
      findUnique: (...args: unknown[]) => mockSquareFindUnique(...args),
    },
    store: {
      findUnique: (...args: unknown[]) => mockStoreFindUnique(...args),
      upsert: (...args: unknown[]) => mockStoreUpsert(...args),
    },
    productClick: {
      groupBy: (...args: unknown[]) => mockClickGroupBy(...args),
    },
  },
}));

import { GET, PUT } from "@/app/api/stores/[squareId]/route";

const params = Promise.resolve({ squareId: "sq1" });

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "A",
    description: null,
    priceCents: 100,
    buyUrl: null,
    active: true,
    sortOrder: 0,
    images: [],
    _count: { clicks: 0 },
    ...overrides,
  };
}

describe("GET /api/stores/[squareId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404 when no store", async () => {
    mockStoreFindUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/stores/sq1"), {
      params,
    });
    expect(res.status).toBe(404);
  });

  it("hides inactive products for public", async () => {
    mockAuth.mockResolvedValue(null);
    mockStoreFindUnique.mockResolvedValue({
      id: "st1",
      squareId: "sq1",
      name: "Shop",
      about: null,
      email: null,
      phone: null,
      address: null,
      hours: null,
      websiteUrl: null,
      square: { ownerId: "owner-1" },
      products: [
        product({ id: "p1", active: true }),
        product({ id: "p2", name: "B", active: false, sortOrder: 1 }),
      ],
    });
    const res = await GET(new Request("http://localhost/api/stores/sq1"), {
      params,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    expect(body.products[0].clickCount).toBeUndefined();
    expect(body.store.estimatedOwedCents).toBeUndefined();
    expect(body.products[0].estimatedOwedCents).toBeUndefined();
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(mockClickGroupBy).not.toHaveBeenCalled();
  });

  it("includes inactive products for owner with mine=1", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockStoreFindUnique.mockResolvedValue({
      id: "st1",
      squareId: "sq1",
      name: "Shop",
      about: null,
      email: null,
      phone: null,
      address: null,
      hours: null,
      websiteUrl: null,
      square: { ownerId: "owner-1" },
      products: [
        product({ id: "p1", active: true, _count: { clicks: 3 } }),
        product({ id: "p2", name: "B", active: false, sortOrder: 1 }),
      ],
    });
    mockGetBalance.mockResolvedValue({
      lifetimeFeesCents: 278,
      paidCents: 228,
      unpaidCents: 50,
      canPayCommission: true,
    });
    mockClickGroupBy.mockResolvedValue([
      { productId: "p1", _sum: { feeCents: 278 } },
    ]);
    const res = await GET(
      new Request("http://localhost/api/stores/sq1?mine=1"),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products.map((p: { id: string }) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(body.products[0].clickCount).toBe(3);
    expect(body.products[1].clickCount).toBe(0);
    expect(body.store.estimatedOwedCents).toBe(50);
    expect(body.store.lifetimeFeesCents).toBe(278);
    expect(body.store.paidCents).toBe(228);
    expect(body.store.canPayCommission).toBe(true);
    expect(body.products[0].estimatedOwedCents).toBe(278);
    expect(body.products[1].estimatedOwedCents).toBe(0);
    expect(mockGetBalance).toHaveBeenCalled();
    expect(mockClickGroupBy).toHaveBeenCalled();
  });
});

describe("PUT /api/stores/[squareId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    mockSquareFindUnique.mockResolvedValue({
      id: "sq1",
      ownerId: "owner-1",
      status: "owned",
      store: null,
    });
    const res = await PUT(
      new Request("http://localhost/api/stores/sq1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Shop" }),
      }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("403 for non-owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "other" } });
    mockSquareFindUnique.mockResolvedValue({
      id: "sq1",
      ownerId: "owner-1",
      status: "owned",
      store: null,
    });
    const res = await PUT(
      new Request("http://localhost/api/stores/sq1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Shop" }),
      }),
      { params },
    );
    expect(res.status).toBe(403);
  });

  it("upserts store for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockSquareFindUnique.mockResolvedValue({
      id: "sq1",
      ownerId: "owner-1",
      status: "owned",
      store: null,
    });
    mockStoreUpsert.mockResolvedValue({
      id: "st1",
      squareId: "sq1",
      name: "Shop",
      about: null,
      email: null,
      phone: null,
      address: null,
      hours: null,
      websiteUrl: null,
    });
    const res = await PUT(
      new Request("http://localhost/api/stores/sq1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Shop" }),
      }),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.store.name).toBe("Shop");
    expect(mockStoreUpsert).toHaveBeenCalled();
  });
});
