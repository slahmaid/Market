import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "squares");

function sanitizeSquareId(squareId: string): string {
  const safeId = path.basename(squareId);
  if (!safeId || safeId !== squareId || safeId.includes("..")) {
    throw new Error("Invalid square id");
  }
  return safeId;
}

export async function saveSquareImage(
  squareId: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error("Invalid image type");
  }

  const safeId = sanitizeSquareId(squareId);

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const outputPath = path.join(UPLOADS_DIR, `${safeId}.webp`);

  await sharp(bytes)
    .resize(128, 128, { fit: "cover" })
    .webp()
    .toFile(outputPath);

  return `/uploads/squares/${safeId}.webp`;
}
