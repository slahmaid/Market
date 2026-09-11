import { describe, expect, it } from "vitest";
import { dollarsToCents, MAX_LIST_PRICE_CENTS } from "@/lib/listing";

describe("dollarsToCents", () => {
  it("parses valid dollar amounts", () => {
    expect(dollarsToCents("1")).toBe(100);
    expect(dollarsToCents("100.00")).toBe(10000);
    expect(dollarsToCents("0.01")).toBe(1);
    expect(dollarsToCents(" 12.5 ")).toBe(1250);
  });

  it("rejects non-numeric garbage that parseFloat would accept", () => {
    expect(dollarsToCents("12abc")).toBeNull();
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("   ")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
  });

  it("rejects below 1¢ and above Int32 max", () => {
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("0.001")).toBeNull();
    expect(dollarsToCents(String((MAX_LIST_PRICE_CENTS + 1) / 100))).toBeNull();
    expect(dollarsToCents(String(MAX_LIST_PRICE_CENTS / 100))).toBe(
      MAX_LIST_PRICE_CENTS,
    );
  });
});

describe("MAX_LIST_PRICE_CENTS", () => {
  it("is Prisma Int32 max", () => {
    expect(MAX_LIST_PRICE_CENTS).toBe(2_147_483_647);
  });
});
