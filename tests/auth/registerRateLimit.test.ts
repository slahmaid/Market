import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("registration rate limit", () => {
  it("allows five attempts per IP and rejects the sixth", () => {
    let now = 1_000;
    const limiter = createRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60_000,
      now: () => now,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.check("203.0.113.1").allowed).toBe(true);
    }
    expect(limiter.check("203.0.113.1").allowed).toBe(false);

    now += 15 * 60_000;
    expect(limiter.check("203.0.113.1").allowed).toBe(true);
  });

  it("tracks IP addresses independently", () => {
    const limiter = createRateLimiter({
      maxAttempts: 1,
      windowMs: 1_000,
    });

    expect(limiter.check("203.0.113.1").allowed).toBe(true);
    expect(limiter.check("203.0.113.2").allowed).toBe(true);
  });
});
