import { describe, expect, it, beforeEach } from "vitest";
import { sanitizeMessageBody } from "@/lib/chat/sanitizeMessageBody";
import { checkRateLimit, resetRateLimits } from "@/lib/chat/rateLimit";

describe("sanitizeMessageBody", () => {
  it("rejects empty and oversized", () => {
    expect(sanitizeMessageBody("")).toBeNull();
    expect(sanitizeMessageBody("   ")).toBeNull();
    expect(sanitizeMessageBody("a".repeat(2001))).toBeNull();
  });

  it("trims and strips null bytes", () => {
    expect(sanitizeMessageBody("  hi\0 there  ")).toBe("hi there");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to limit then blocks", () => {
    const key = "t1";
    expect(checkRateLimit(key, 2, 60_000, 1000)).toBe(true);
    expect(checkRateLimit(key, 2, 60_000, 1001)).toBe(true);
    expect(checkRateLimit(key, 2, 60_000, 1002)).toBe(false);
  });

  it("resets after window", () => {
    const key = "t2";
    expect(checkRateLimit(key, 1, 1000, 1000)).toBe(true);
    expect(checkRateLimit(key, 1, 1000, 1001)).toBe(false);
    expect(checkRateLimit(key, 1, 1000, 2001)).toBe(true);
  });
});
