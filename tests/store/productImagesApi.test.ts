import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockSquareFindUnique = vi.fn();
const mockProductFindFirst = vi.fn();
const mockProductImageCreate = vi.fn();
const mockProductImageFindFirst = vi.fn();
const mockProductImageDelete = vi.fn();
const mockSaveProductImage = vi.fn();
const mockDeleteProductImageFile = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    square: {
      findUnique: (...args: unknown[]) => mockSquareFindUnique(...args),
    },
    product: {
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
    },
    productImage: {
      create: (...args: unknown[]) => mockProductImageCreate(...args),
      findFirst: (...args: unknown[]) => mockProductImageFindFirst(...args),
      delete: (...args: unknown[]) => mockProductImageDelete(...args),
    },
  },
}));

vi.mock("@/lib/storage/productImage", () => ({
  saveProductImage: (...args: unknown[]) => mockSaveProductImage(...args),
  deleteProductImageFile: (...args: unknown[]) =>
    mockDeleteProductImageFile(...args),
}));

import { POST } from "@/app/api/stores/[squareId]/products/[productId]/images/route";
import { DELETE } from "@/app/api/stores/[squareId]/products/[productId]/images/[imageId]/route";

const postParams = Promise.resolve({ squareId: "sq1", productId: "prod1" });
const deleteParams = Promise.resolve({
  squareId: "sq1",
  productId: "prod1",
  imageId: "img1",
});

function ownerGate() {
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

describe("product images API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST 401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    ownerGate();
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products/prod1/images", {
        method: "POST",
        body: form,
      }),
      { params: postParams },
    );
    expect(res.status).toBe(401);
  });

  it("POST 400 at 5 images", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGate();
    mockProductFindFirst.mockResolvedValue({
      id: "prod1",
      storeId: "st1",
      images: Array.from({ length: 5 }, (_, i) => ({ id: `i${i}` })),
    });
    const form = new FormData();
    form.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }),
    );
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products/prod1/images", {
        method: "POST",
        body: form,
      }),
      { params: postParams },
    );
    expect(res.status).toBe(400);
  });

  it("POST success returns image", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    ownerGate();
    mockProductFindFirst.mockResolvedValue({
      id: "prod1",
      storeId: "st1",
      images: [],
    });
    mockSaveProductImage.mockResolvedValue("/uploads/products/prod1/img.webp");
    mockProductImageCreate.mockResolvedValue({
      id: "img1",
      url: "/uploads/products/prod1/img.webp",
      sortOrder: 0,
    });
    const form = new FormData();
    form.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }),
    );
    const res = await POST(
      new Request("http://localhost/api/stores/sq1/products/prod1/images", {
        method: "POST",
        body: form,
      }),
      { params: postParams },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.image.url).toContain("/uploads/products/");
  });

  it("DELETE 403 non-owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "other" } });
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
    const res = await DELETE(
      new Request(
        "http://localhost/api/stores/sq1/products/prod1/images/img1",
        { method: "DELETE" },
      ),
      { params: deleteParams },
    );
    expect(res.status).toBe(403);
  });
});
