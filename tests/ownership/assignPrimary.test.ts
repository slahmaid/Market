import { beforeEach, describe, expect, it, vi } from "vitest";

const squareUpdateMany = vi.fn();
const transactionCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        square: { updateMany: squareUpdateMany },
        transaction: { create: transactionCreate },
      }),
    ),
  },
}));

import { assertSquareBuyable, completePrimaryPurchase } from "@/lib/ownership";

describe("assertSquareBuyable", () => {
  it("allows platform square for any buyer", () => {
    expect(() =>
      assertSquareBuyable({ status: "platform", ownerId: null }, "user1"),
    ).not.toThrow();
  });

  it("rejects owned square", () => {
    expect(() =>
      assertSquareBuyable({ status: "owned", ownerId: "u2" }, "user1"),
    ).toThrow(/sold|owned/i);
  });

  it("rejects listed square in Phase 2 primary path", () => {
    expect(() =>
      assertSquareBuyable({ status: "listed", ownerId: "u2" }, "user1"),
    ).toThrow();
  });
});

describe("completePrimaryPurchase", () => {
  beforeEach(() => {
    squareUpdateMany.mockReset();
    transactionCreate.mockReset();
  });

  it("assigns ownership and creates primary Transaction when square is platform", async () => {
    squareUpdateMany.mockResolvedValue({ count: 1 });
    transactionCreate.mockResolvedValue({ id: "tx1" });

    const result = await completePrimaryPurchase({
      squareId: "sq1",
      buyerId: "buyer1",
      amountCents: 500,
      stripeCheckoutSessionId: "cs_test_1",
    });

    expect(result).toEqual({ ok: true });
    expect(squareUpdateMany).toHaveBeenCalledWith({
      where: { id: "sq1", status: "platform" },
      data: { status: "owned", ownerId: "buyer1" },
    });
    expect(transactionCreate).toHaveBeenCalledWith({
      data: {
        squareId: "sq1",
        buyerId: "buyer1",
        sellerId: null,
        amountCents: 500,
        feeCents: 0,
        type: "primary",
        stripeCheckoutSessionId: "cs_test_1",
      },
    });
  });

  it("returns not_buyable without creating Transaction when square is not platform", async () => {
    squareUpdateMany.mockResolvedValue({ count: 0 });

    const result = await completePrimaryPurchase({
      squareId: "sq1",
      buyerId: "buyer1",
      amountCents: 500,
      stripeCheckoutSessionId: "cs_test_2",
    });

    expect(result).toEqual({ ok: false, reason: "not_buyable" });
    expect(transactionCreate).not.toHaveBeenCalled();
  });
});
