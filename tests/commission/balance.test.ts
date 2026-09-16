import { describe, expect, it } from "vitest";
import {
  MIN_COMMISSION_CHECKOUT_CENTS,
  computeUnpaidCents,
  canPayCommission,
} from "@/lib/commission/balance";

describe("computeUnpaidCents", () => {
  it("subtracts paid from fees", () => {
    expect(computeUnpaidCents(200, 50)).toBe(150);
  });

  it("floors at 0 when overpaid", () => {
    expect(computeUnpaidCents(100, 150)).toBe(0);
  });
});

describe("canPayCommission", () => {
  it("false below 50", () => {
    expect(canPayCommission(49)).toBe(false);
    expect(MIN_COMMISSION_CHECKOUT_CENTS).toBe(50);
  });

  it("true at 50+", () => {
    expect(canPayCommission(50)).toBe(true);
  });
});
