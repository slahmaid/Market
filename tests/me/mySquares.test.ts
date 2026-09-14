import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    square: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { GET } from "@/app/api/me/squares/route";

describe("GET /api/me/squares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("queries squares owned by user with owned or listed status", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        ownerId: "user-1",
        status: { in: ["owned", "listed"] },
      },
      select: {
        id: true,
        x: true,
        y: true,
        status: true,
        imageUrl: true,
        linkUrl: true,
        listPriceCents: true,
      },
      orderBy: [{ y: "asc" }, { x: "asc" }],
    });
  });

  it("returns mapped squares JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindMany.mockResolvedValue([
      {
        id: "sq-1",
        x: 2,
        y: 1,
        status: "owned",
        imageUrl: "https://example.com/a.png",
        linkUrl: "https://example.com",
        listPriceCents: null,
      },
      {
        id: "sq-2",
        x: 0,
        y: 0,
        status: "listed",
        imageUrl: null,
        linkUrl: null,
        listPriceCents: 5000,
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      squares: [
        {
          id: "sq-1",
          x: 2,
          y: 1,
          status: "owned",
          imageUrl: "https://example.com/a.png",
          linkUrl: "https://example.com",
          listPriceCents: null,
        },
        {
          id: "sq-2",
          x: 0,
          y: 0,
          status: "listed",
          imageUrl: null,
          linkUrl: null,
          listPriceCents: 5000,
        },
      ],
    });
  });

  it("returns 503 when database is unavailable", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindMany.mockRejectedValue(new Error("db down"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ error: "Database unavailable" });
  });
});
