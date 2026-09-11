import { describe, expect, it } from "vitest";
import { assertCanList, assertCanUnlist } from "@/lib/listing";

describe("assertCanList", () => {
  it("allows owner of owned square", () => {
    expect(() =>
      assertCanList({ status: "owned", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("allows owner of listed square (price update)", () => {
    expect(() =>
      assertCanList({ status: "listed", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("rejects non-owner", () => {
    expect(() =>
      assertCanList({ status: "owned", ownerId: "u1" }, "u2"),
    ).toThrow(/owner/i);
  });

  it("rejects platform square", () => {
    expect(() =>
      assertCanList({ status: "platform", ownerId: null }, "u1"),
    ).toThrow();
  });
});

describe("assertCanUnlist", () => {
  it("allows owner of listed square", () => {
    expect(() =>
      assertCanUnlist({ status: "listed", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("rejects owned (not listed)", () => {
    expect(() =>
      assertCanUnlist({ status: "owned", ownerId: "u1" }, "u1"),
    ).toThrow(/listed/i);
  });
});
