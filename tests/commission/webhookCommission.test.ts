import { beforeEach, describe, expect, it, vi } from "vitest";

const commissionFindUnique = vi.fn();
const commissionUpdate = vi.fn();
const transactionFindUnique = vi.fn();
const refundsCreate = vi.fn();
const constructEvent = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    transaction: {
      findUnique: (...args: unknown[]) => transactionFindUnique(...args),
    },
    commissionPayment: {
      findUnique: (...args: unknown[]) => commissionFindUnique(...args),
      update: (...args: unknown[]) => commissionUpdate(...args),
    },
    square: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/ownership", () => ({
  completePrimaryPurchase: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => constructEvent(...args) },
    refunds: { create: (...args: unknown[]) => refundsCreate(...args) },
  }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

function commissionSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_comm_1",
    amount_total: 100,
    payment_status: "paid",
    payment_intent: "pi_comm_1",
    metadata: {
      type: "commission",
      storeId: "st1",
      squareId: "sq1",
      amountCents: "100",
      payerId: "u1",
    },
    ...overrides,
  };
}

function webhookRequest(session: ReturnType<typeof commissionSession>) {
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

describe("stripe webhook commission", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    commissionFindUnique.mockReset();
    commissionUpdate.mockReset();
    refundsCreate.mockReset();
    constructEvent.mockReset();
  });

  it("marks payment succeeded when amount matches", async () => {
    commissionFindUnique.mockResolvedValue({
      id: "pay1",
      amountCents: 100,
      status: "pending",
    });
    commissionUpdate.mockResolvedValue({});

    const res = await POST(webhookRequest(commissionSession()));
    expect(res.status).toBe(200);
    expect(commissionUpdate).toHaveBeenCalledWith({
      where: { id: "pay1" },
      data: {
        status: "succeeded",
        succeededAt: expect.any(Date),
      },
    });
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("idempotent when already succeeded", async () => {
    commissionFindUnique.mockResolvedValue({
      id: "pay1",
      amountCents: 100,
      status: "succeeded",
    });

    const res = await POST(webhookRequest(commissionSession()));
    expect(res.status).toBe(200);
    expect(commissionUpdate).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("refunds on amount mismatch", async () => {
    commissionFindUnique.mockResolvedValue({
      id: "pay1",
      amountCents: 100,
      status: "pending",
    });

    const res = await POST(
      webhookRequest(commissionSession({ amount_total: 999 })),
    );
    expect(res.status).toBe(200);
    expect(commissionUpdate).not.toHaveBeenCalled();
    expect(refundsCreate).toHaveBeenCalled();
  });

  it("ignores unpaid payment_status", async () => {
    const res = await POST(
      webhookRequest(commissionSession({ payment_status: "unpaid" })),
    );
    expect(res.status).toBe(200);
    expect(commissionFindUnique).not.toHaveBeenCalled();
    expect(commissionUpdate).not.toHaveBeenCalled();
  });

  it("no-ops when payment row missing", async () => {
    commissionFindUnique.mockResolvedValue(null);
    const res = await POST(webhookRequest(commissionSession()));
    expect(res.status).toBe(200);
    expect(commissionUpdate).not.toHaveBeenCalled();
  });
});
