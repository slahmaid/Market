import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionFindUnique = vi.fn();
const squareFindUnique = vi.fn();
const completePrimaryPurchase = vi.fn();
const refundsCreate = vi.fn();
const constructEvent = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    transaction: { findUnique: (...args: unknown[]) => transactionFindUnique(...args) },
    square: { findUnique: (...args: unknown[]) => squareFindUnique(...args) },
  },
}));

vi.mock("@/lib/ownership", () => ({
  completePrimaryPurchase: (...args: unknown[]) => completePrimaryPurchase(...args),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => constructEvent(...args) },
    refunds: { create: (...args: unknown[]) => refundsCreate(...args) },
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

function primarySession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_session",
    amount_total: 500,
    payment_intent: "pi_test_1",
    metadata: {
      type: "primary",
      squareId: "sq1",
      buyerId: "buyer1",
    },
    ...overrides,
  };
}

function webhookRequest(session: ReturnType<typeof primarySession>) {
  constructEvent.mockReturnValue({
    type: "checkout.session.completed",
    data: { object: session },
  });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

describe("stripe webhook primary ownership", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    transactionFindUnique.mockReset();
    squareFindUnique.mockReset();
    completePrimaryPurchase.mockReset();
    refundsCreate.mockReset();
    constructEvent.mockReset();
  });

  it("same sessionId second pass does not refund", async () => {
    transactionFindUnique.mockResolvedValue({ id: "tx1" });

    const res = await POST(webhookRequest(primarySession()));

    expect(res.status).toBe(200);
    expect(completePrimaryPurchase).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("does not refund when not_buyable but session Transaction appears before refund", async () => {
    transactionFindUnique
      .mockResolvedValueOnce(null) // early settled check
      .mockResolvedValueOnce({ id: "tx_winner" }); // re-check inside refundIfPossible
    squareFindUnique.mockResolvedValue({ id: "sq1", status: "owned" });

    const res = await POST(webhookRequest(primarySession()));

    expect(res.status).toBe(200);
    expect(completePrimaryPurchase).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("returns 200 when refund throws after ownership settled as loser", async () => {
    transactionFindUnique.mockResolvedValue(null);
    squareFindUnique.mockResolvedValue({ id: "sq1", status: "platform" });
    completePrimaryPurchase.mockResolvedValue({ ok: false, reason: "not_buyable" });
    refundsCreate.mockRejectedValue(new Error("stripe refund unavailable"));

    const res = await POST(webhookRequest(primarySession()));

    expect(res.status).toBe(200);
    expect(refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_test_1" },
      { idempotencyKey: "primary-refund:cs_test_session" },
    );
  });

  it("refunds when squareId/buyerId metadata missing but payment_intent exists", async () => {
    transactionFindUnique.mockResolvedValue(null);
    refundsCreate.mockResolvedValue({ id: "re_1" });

    const res = await POST(
      webhookRequest(
        primarySession({
          metadata: { type: "primary" },
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(completePrimaryPurchase).not.toHaveBeenCalled();
    expect(refundsCreate).toHaveBeenCalled();
  });

  it("refunds when amount_total is null instead of recording $0", async () => {
    transactionFindUnique.mockResolvedValue(null);
    refundsCreate.mockResolvedValue({ id: "re_2" });

    const res = await POST(
      webhookRequest(primarySession({ amount_total: null })),
    );

    expect(res.status).toBe(200);
    expect(completePrimaryPurchase).not.toHaveBeenCalled();
    expect(refundsCreate).toHaveBeenCalled();
  });
});
