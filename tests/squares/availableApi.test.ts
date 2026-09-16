import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    square: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { GET } from "@/app/api/squares/available/route";

describe("GET /api/squares/available", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cheapest platform squares with askCents", async () => {
    mockFindMany.mockResolvedValue([
      { id: "center", x: 24, y: 24 },
      { id: "corner", x: 0, y: 0 },
    ]);

    const res = await GET(
      new Request("http://localhost/api/squares/available?limit=50&offset=0"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: "platform" },
      select: { id: true, x: true, y: true },
    });
    expect(body.squares[0].id).toBe("corner");
    expect(body.squares[0]).toMatchObject({
      id: "corner",
      x: 0,
      y: 0,
      askCents: expect.any(Number),
    });
    expect(body.nextOffset).toBeNull();
  });

  it("returns 503 when database is unavailable", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));

    const res = await GET(
      new Request("http://localhost/api/squares/available"),
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ error: "Database unavailable" });
  });
});
