import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockRequireOwner = vi.fn();
const mockGetBalance = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockSessionsCreate = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/store/assertSquareStoreOwner", () => ({
  requireSquareStoreOwner: (...args: unknown[]) => mockRequireOwner(...args),
}));

vi.mock("@/lib/commission/balance", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/commission/balance")
  >("@/lib/commission/balance");
  return {
    ...actual,
    getStoreCommissionBalance: (...args: unknown[]) => mockGetBalance(...args),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    commissionPayment: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockSessionsCreate(...args),
      },
    },
  }),
}));

import { POST } from "@/app/api/stores/[squareId]/commission/checkout/route";

const params = Promise.resolve({ squareId: "sq1" });

describe("POST /api/stores/[squareId]/commission/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("401 without session", async () => {
    mockAuth.mockResolvedValue(null);
    mockRequireOwner.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(401);
  });

  it("403 for non-owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRequireOwner.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(403);
  });

  it("404 when no store", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRequireOwner.mockResolvedValue({
      ok: true,
      square: { id: "sq1", ownerId: "u1", status: "owned" },
      store: null,
    });
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(404);
  });

  it("400 when unpaid below 50", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRequireOwner.mockResolvedValue({
      ok: true,
      square: { id: "sq1", ownerId: "u1", status: "owned" },
      store: { id: "st1", squareId: "sq1", name: "S" },
    });
    mockGetBalance.mockResolvedValue({
      lifetimeFeesCents: 49,
      paidCents: 0,
      unpaidCents: 49,
      canPayCommission: false,
    });
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Balance too small to pay yet");
  });

  it("409 when pending checkout exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRequireOwner.mockResolvedValue({
      ok: true,
      square: { id: "sq1", ownerId: "u1", status: "owned" },
      store: { id: "st1", squareId: "sq1", name: "S" },
    });
    mockGetBalance.mockResolvedValue({
      lifetimeFeesCents: 100,
      paidCents: 0,
      unpaidCents: 100,
      canPayCommission: true,
    });
    mockFindFirst.mockResolvedValue({ id: "pend1" });
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    expect(res.status).toBe(409);
  });

  it("creates checkout and pending payment", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockRequireOwner.mockResolvedValue({
      ok: true,
      square: { id: "sq1", ownerId: "u1", status: "owned" },
      store: { id: "st1", squareId: "sq1", name: "S" },
    });
    mockGetBalance.mockResolvedValue({
      lifetimeFeesCents: 100,
      paidCents: 0,
      unpaidCents: 100,
      canPayCommission: true,
    });
    mockFindFirst.mockResolvedValue(null);
    mockSessionsCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/test",
    });
    mockCreate.mockResolvedValue({ id: "pay1" });

    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/test");
    expect(mockSessionsCreate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        storeId: "st1",
        amountCents: 100,
        stripeCheckoutSessionId: "cs_test_1",
        status: "pending",
      },
    });
  });
});
