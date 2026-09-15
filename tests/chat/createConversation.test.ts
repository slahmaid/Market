import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockStoreFindUnique = vi.fn();
const mockConvoFindUnique = vi.fn();
const mockConvoCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/chat/rateLimit", () => ({
  checkRateLimit: () => true,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    store: { findUnique: (...a: unknown[]) => mockStoreFindUnique(...a) },
    conversation: {
      findUnique: (...a: unknown[]) => mockConvoFindUnique(...a),
      create: (...a: unknown[]) => mockConvoCreate(...a),
    },
  },
}));

import { POST } from "@/app/api/stores/[squareId]/conversations/route";

const params = Promise.resolve({ squareId: "sq1" });

describe("POST /api/stores/[squareId]/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(401);
  });

  it("403 when caller owns the store", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockStoreFindUnique.mockResolvedValue({
      id: "st1",
      square: { ownerId: "owner-1" },
    });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(403);
  });

  it("returns existing conversation", async () => {
    mockAuth.mockResolvedValue({ user: { id: "buyer-1" } });
    mockStoreFindUnique.mockResolvedValue({
      id: "st1",
      square: { ownerId: "owner-1" },
    });
    mockConvoFindUnique.mockResolvedValue({
      id: "c1",
      storeId: "st1",
      buyerId: "buyer-1",
      status: "open",
      updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.conversation.id).toBe("c1");
    expect(mockConvoCreate).not.toHaveBeenCalled();
  });
});
