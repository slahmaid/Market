import { afterEach, describe, expect, it, vi } from "vitest";
import { listSquare, unlistSquare } from "@/lib/listing/listSquare";

describe("listSquare / unlistSquare client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs listPriceCents and returns square + quote", async () => {
    const payload = {
      square: {
        id: "sq_1",
        x: 0,
        y: 0,
        status: "listed",
        imageUrl: null,
        linkUrl: null,
        listPriceCents: 12500,
        ownerId: "u_1",
      },
      quote: {
        askCents: 12500,
        suggestedPriceCents: 10000,
        label: "balanced",
        reason: "Ask is above suggested value (25%).",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSquare("sq_1", 12500)).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/squares/sq_1/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listPriceCents: 12500 }),
    });
  });

  it("throws API error message when list fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Only the owner can list" }),
      }),
    );

    await expect(listSquare("sq_1", 100)).rejects.toThrow(/Only the owner/);
  });

  it("POSTs unlist and returns square + quote", async () => {
    const payload = {
      square: {
        id: "sq_1",
        x: 0,
        y: 0,
        status: "owned",
        imageUrl: null,
        linkUrl: null,
        listPriceCents: null,
        ownerId: "u_1",
      },
      quote: {
        askCents: 10000,
        suggestedPriceCents: 10000,
        label: "fair",
        reason: "Ask is at suggested value within 10%.",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(unlistSquare("sq_1")).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/squares/sq_1/unlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("throws when list response lacks square/quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(listSquare("sq_1", 100)).rejects.toThrow(/List failed/i);
  });
});
