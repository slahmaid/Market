import { afterEach, describe, expect, it, vi } from "vitest";
import { startPrimaryCheckout } from "@/lib/checkout/startPrimaryCheckout";

describe("startPrimaryCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs squareId and returns checkout url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/c/pay/test" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(startPrimaryCheckout("sq_1")).resolves.toBe(
      "https://checkout.stripe.com/c/pay/test",
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/checkout/primary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ squareId: "sq_1" }),
    });
  });

  it("throws API error message when checkout fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Stripe is not configured" }),
      }),
    );

    await expect(startPrimaryCheckout("sq_1")).rejects.toThrow(
      /Stripe is not configured/,
    );
  });

  it("throws when response has no url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(startPrimaryCheckout("sq_1")).rejects.toThrow(/Checkout failed/i);
  });
});
