import { describe, expect, it } from "vitest";
import {
  productCreateSchema,
  storeUpsertSchema,
} from "@/lib/store/storeSchemas";

describe("storeUpsertSchema", () => {
  it("requires name", () => {
    expect(storeUpsertSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects non-https websiteUrl", () => {
    expect(
      storeUpsertSchema.safeParse({
        name: "Shop",
        websiteUrl: "http://x.com",
      }).success,
    ).toBe(false);
  });

  it("accepts https websiteUrl and trims name", () => {
    const r = storeUpsertSchema.safeParse({
      name: "  Cafe  ",
      websiteUrl: "https://cafe.example",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Cafe");
  });
});

describe("productCreateSchema", () => {
  it("rejects negative priceCents", () => {
    expect(
      productCreateSchema.safeParse({ name: "Mug", priceCents: -1 }).success,
    ).toBe(false);
  });

  it("rejects http buyUrl", () => {
    expect(
      productCreateSchema.safeParse({
        name: "Mug",
        priceCents: 500,
        buyUrl: "http://bad",
      }).success,
    ).toBe(false);
  });
});
