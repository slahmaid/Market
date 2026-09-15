import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockTxFindMany = vi.fn();
const mockSquareFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    transaction: {
      findMany: (...args: unknown[]) => mockTxFindMany(...args),
    },
    square: {
      findMany: (...args: unknown[]) => mockSquareFindMany(...args),
    },
  },
}));

import { GET } from "@/app/api/me/feed/route";

describe("GET /api/me/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockTxFindMany).not.toHaveBeenCalled();
  });

  it("returns real purchase and listing items only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx1",
        type: "primary",
        amountCents: 500,
        buyerId: "user-1",
        sellerId: null,
        createdAt: new Date("2026-09-14T10:00:00.000Z"),
        square: { id: "sq1", x: 0, y: 0 },
      },
    ]);
    mockSquareFindMany.mockResolvedValue([
      {
        id: "sq2",
        x: 1,
        y: 2,
        listPriceCents: 2500,
        updatedAt: new Date("2026-09-14T09:00:00.000Z"),
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe("tx:tx1");
    expect(body.items[0].type).toBe("sale");
    expect(body.items[1].id).toBe("listing:sq2");
    expect(body.items[1].type).toBe("listing");
  });
});
