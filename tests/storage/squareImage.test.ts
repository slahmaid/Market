import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { saveSquareImage } from "@/lib/storage/squareImage";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "squares");

async function createPng(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 128, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

async function removeTestFile(squareId: string) {
  const filePath = path.join(UPLOADS_DIR, `${squareId}.webp`);
  await fs.unlink(filePath).catch(() => undefined);
}

describe("saveSquareImage", () => {
  afterEach(async () => {
    await removeTestFile("test-square-1");
    await removeTestFile("test-square-2");
    await removeTestFile("test-square-large");
    await removeTestFile("test-square-wide");
  });

  it("saves a valid PNG and returns the public web path", async () => {
    const png = await createPng(64, 64);
    const url = await saveSquareImage("test-square-1", png, "image/png");

    expect(url).toBe("/uploads/squares/test-square-1.webp");

    const filePath = path.join(UPLOADS_DIR, "test-square-1.webp");
    await expect(fs.access(filePath)).resolves.toBeUndefined();

    const meta = await sharp(filePath).metadata();
    expect(meta.format).toBe("webp");
  });

  it("rejects non-image mime types", async () => {
    const png = await createPng(8, 8);
    await expect(
      saveSquareImage("test-square-2", png, "application/pdf"),
    ).rejects.toThrow(/invalid image/i);

    const filePath = path.join(UPLOADS_DIR, "test-square-2.webp");
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("square-crops non-square images to 128x128", async () => {
    const widePng = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await saveSquareImage("test-square-wide", widePng, "image/png");

    const filePath = path.join(UPLOADS_DIR, "test-square-wide.webp");
    const meta = await sharp(filePath).metadata();

    expect(meta.width).toBe(128);
    expect(meta.height).toBe(128);
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBeLessThanOrEqual(128);
    expect(meta.height).toBeLessThanOrEqual(128);
  });

  it("rejects gif mime type", async () => {
    const png = await createPng(8, 8);
    await expect(
      saveSquareImage("test-square-2", png, "image/gif"),
    ).rejects.toThrow(/invalid image/i);
  });

  it("rejects path traversal in squareId", async () => {
    const png = await createPng(8, 8);
    await expect(
      saveSquareImage("../evil", png, "image/png"),
    ).rejects.toThrow(/invalid square id/i);
  });
});
