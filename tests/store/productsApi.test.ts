import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSquareFindUnique = vi.fn();
const mockProductCount = vi.fn();
const mockProductCreate = vi.fn();
const mockProductFindFirst = vi.fn();
const mockProductUpdate = vi.fn();
const mockProductDelete = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    square: {
      findUnique: (...args: unknown[]) => mockSquareFindUnique(...args),
    },
    product: {
      count: (...args: unknown[]) => mockProductCount(...args),
      create: (...args: unknown[]) => mockProductCreate(...args),
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
      update: (...args: unknown[]) => mockProductUpdate(...args),
      delete: (...args: unknown[]) => mockProductDelete(...args),
    },
  },
}));

import { POST } from "@/app/api/stores/[squareId]/products/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/stores/[squareId]/products/[productId]/route";

const squareParams = Promise.resolve({ squareId: "sq1" });
const productParams = Promise.resolve({ squareId: "sq1", productId: "prod1" });

function ownerGateStore() {
  mockSquareFindUnique.mockResolvedValue({
    id: "sq1",
    ownerId: "owner-1",
    status: "owned",
    store: {
      id: "st1",
      squareId: "sq1",
      name: "Shop",
      about: null,
      email: null,
      phone: null,
      address: null,
      hours: null,
      websiteUrl: null,
    },
  });
}

describe("POST /api/stores/[squareId]/products", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    ownerGateStore();
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mug", priceCents: 500 }),
      }),
      { params: squareParams },
    );
    expect(res.status).toBe(401);
  });

  it("400 when product limit reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGateStore();
    mockProductCount.mockResolvedValue(50);
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mug", priceCents: 500 }),
      }),
      { params: squareParams },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/limit/i);
  });

  it("404 when store missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockSquareFindUnique.mockResolvedValue({
      id: "sq1",
      ownerId: "owner-1",
      status: "owned",
      store: null,
    });
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mug", priceCents: 500 }),
      }),
      { params: squareParams },
    );
    expect(res.status).toBe(404);
  });

  it("creates product for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGateStore();
    mockProductCount.mockResolvedValue(0);
    mockProductCreate.mockResolvedValue({
      id: "prod1",
      name: "Mug",
      description: null,
      priceCents: 500,
      buyUrl: null,
      active: true,
      sortOrder: 0,
      images: [],
    });
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Mug", priceCents: 500 }),
      }),
      { params: squareParams },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.product.name).toBe("Mug");
  });
});

describe("PATCH/DELETE product", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 PATCH for non-owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "other" } });
    mockSquareFindUnique.mockResolvedValue({
      id: "sq1",
      ownerId: "owner-1",
      status: "owned",
      store: { id: "st1", squareId: "sq1", name: "Shop", about: null, email: null, phone: null, address: null, hours: null, websiteUrl: null },
    });
    const res = await PATCH(
      new Request("http://localhost/api/stores/sq1/products/prod1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
      { params: productParams },
    );
    expect(res.status).toBe(403);
  });

  it("404 PATCH when product not on this store", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGateStore();
    mockProductFindFirst.mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://localhost/api/stores/sq1/products/prod1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
      { params: productParams },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE succeeds for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGateStore();
    mockProductFindFirst.mockResolvedValue({
      id: "prod1",
      storeId: "st1",
      images: [],
    });
    mockProductDelete.mockResolvedValue({});
    const res = await DELETE(
      new Request("http://localhost/api/stores/sq1/products/prod1", {
        method: "DELETE",
      }),
      { params: productParams },
    );
    expect(res.status).toBe(200);
    expect(mockProductDelete).toHaveBeenCalled();
  });
});
