import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "squares");

export async function saveSquareImage(
  squareId: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error("Invalid image type");
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const outputPath = path.join(UPLOADS_DIR, `${squareId}.webp`);

  await sharp(bytes)
    .resize(128, 128, { fit: "inside", withoutEnlargement: true })
    .webp()
    .toFile(outputPath);

  return `/uploads/squares/${squareId}.webp`;
}
