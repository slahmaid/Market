import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-credentials";

describe("auth-credentials", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("Secret123!");

    expect(hash).not.toBe("Secret123!");
    expect(await verifyPassword("Secret123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
