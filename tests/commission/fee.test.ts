import { afterEach, describe, expect, it } from "vitest";
import {
  computeClickFeeCents,
  getCommissionFeeBps,
  DEFAULT_COMMISSION_FEE_BPS,
} from "@/lib/commission/fee";

describe("computeClickFeeCents", () => {
  it("floors 1999 × 700 bps", () => {
    expect(computeClickFeeCents(1999, 700)).toBe(139);
  });

  it("returns 0 for zero price", () => {
    expect(computeClickFeeCents(0, 700)).toBe(0);
  });

  it("floors small amounts", () => {
    expect(computeClickFeeCents(1, 700)).toBe(0);
    expect(computeClickFeeCents(15, 700)).toBe(1);
  });
});

describe("getCommissionFeeBps", () => {
  const prev = process.env.COMMISSION_FEE_BPS;

  afterEach(() => {
    if (prev === undefined) delete process.env.COMMISSION_FEE_BPS;
    else process.env.COMMISSION_FEE_BPS = prev;
  });

  it("defaults to 700 when unset", () => {
    delete process.env.COMMISSION_FEE_BPS;
    expect(getCommissionFeeBps()).toBe(DEFAULT_COMMISSION_FEE_BPS);
  });

  it("parses a valid override", () => {
    process.env.COMMISSION_FEE_BPS = "500";
    expect(getCommissionFeeBps()).toBe(500);
  });

  it("falls back to 700 for invalid or negative", () => {
    process.env.COMMISSION_FEE_BPS = "nope";
    expect(getCommissionFeeBps()).toBe(700);
    process.env.COMMISSION_FEE_BPS = "-1";
    expect(getCommissionFeeBps()).toBe(700);
    process.env.COMMISSION_FEE_BPS = "12.5";
    expect(getCommissionFeeBps()).toBe(700);
  });
});
