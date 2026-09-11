import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const squareUpdateMany = vi.fn();
const transactionCreate = vi.fn();
const transactionFindUnique = vi.fn();
const prismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => prismaTransaction(...args),
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
    transactionFindUnique.mockReset();
    prismaTransaction.mockReset();
    // Interactive txn mock: run callback; rethrow so outer P2002 catch can work.
    prismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          square: { updateMany: squareUpdateMany },
          transaction: {
            create: transactionCreate,
            findUnique: transactionFindUnique,
          },
        }),
    );
  });

  it("assigns ownership and creates primary Transaction when square is platform", async () => {
    transactionFindUnique.mockResolvedValue(null);
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

  it("returns ok without mutating when Transaction already exists for session", async () => {
    transactionFindUnique.mockResolvedValue({ id: "tx_existing" });

    const result = await completePrimaryPurchase({
      squareId: "sq1",
      buyerId: "buyer1",
      amountCents: 500,
      stripeCheckoutSessionId: "cs_test_idem",
    });

    expect(result).toEqual({ ok: true });
    expect(squareUpdateMany).not.toHaveBeenCalled();
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("returns not_buyable without creating Transaction when square is not platform", async () => {
    transactionFindUnique.mockResolvedValue(null);
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

  it("treats already-completed session as success when updateMany loses the race", async () => {
    transactionFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "tx_winner", stripeCheckoutSessionId: "cs_race" });
    squareUpdateMany.mockResolvedValue({ count: 0 });

    const result = await completePrimaryPurchase({
      squareId: "sq1",
      buyerId: "buyer1",
      amountCents: 500,
      stripeCheckoutSessionId: "cs_race",
    });

    expect(result).toEqual({ ok: true });
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("treats P2002 escaping $transaction as already-settled success", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["stripeCheckoutSessionId"] },
      },
    );
    // Real Postgres aborts the interactive txn; Prisma surfaces P2002 from $transaction.
    prismaTransaction.mockRejectedValue(p2002);

    const result = await completePrimaryPurchase({
      squareId: "sq1",
      buyerId: "buyer1",
      amountCents: 500,
      stripeCheckoutSessionId: "cs_p2002",
    });

    expect(result).toEqual({ ok: true });
    expect(transactionCreate).not.toHaveBeenCalled();
  });
});
