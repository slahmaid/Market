import { afterEach, describe, expect, it, vi } from "vitest";
import { customizeSquare } from "@/lib/customize/customizeSquare";

describe("customizeSquare", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs multipart FormData with image and linkUrl", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "tile.png", {
      type: "image/png",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        square: {
          id: "sq_1",
          imageUrl: "/uploads/squares/sq_1.webp",
          linkUrl: "https://example.com",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await customizeSquare("sq_1", {
      image: file,
      linkUrl: "https://example.com",
    });

    expect(result.square.imageUrl).toBe("/uploads/squares/sq_1.webp");
    expect(result.square.linkUrl).toBe("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/squares/sq_1/customize");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    const body = init!.body as FormData;
    expect(body.get("image")).toBeInstanceOf(File);
    expect(body.get("linkUrl")).toBe("https://example.com");
  });

  it("omits image when only linkUrl is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        square: { id: "sq_1", imageUrl: null, linkUrl: null },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await customizeSquare("sq_1", { linkUrl: "" });

    const body = fetchMock.mock.calls[0]![1]!.body as FormData;
    expect(body.has("image")).toBe(false);
    expect(body.get("linkUrl")).toBe("");
  });

  it("throws API error message when customize fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      }),
    );

    await expect(
      customizeSquare("sq_1", { linkUrl: "https://example.com" }),
    ).rejects.toThrow(/Forbidden/);
  });
});
