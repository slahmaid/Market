import { describe, expect, it } from "vitest";
import { assertSquareBuyable } from "@/lib/ownership";

describe("assertSquareBuyable", () => {
  it("allows platform square for any buyer", () => {
    expect(() =>
      assertSquareBuyable({ status: "platform", ownerId: null }, "user1"),
    ).not.toThrow();
  });

  it("rejects owned square", () => {
    expect(() =>
      assertSquareBuyable({ status: "owned", ownerId: "u2" }, "user1"),
    ).toThrow(/sold|owned/i);
  });

  it("rejects listed square in Phase 2 primary path", () => {
    expect(() =>
      assertSquareBuyable({ status: "listed", ownerId: "u2" }, "user1"),
    ).toThrow();
  });
});
