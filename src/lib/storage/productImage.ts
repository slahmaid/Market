import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "products");

function sanitizeId(id: string): string {
  const safeId = path.basename(id);
  if (!safeId || safeId !== id || safeId.includes("..")) {
    throw new Error("Invalid id");
  }
  return safeId;
}

export async function saveProductImage(
  productId: string,
  imageId: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error("Invalid image type");
  }

  const safeProductId = sanitizeId(productId);
  const safeImageId = sanitizeId(imageId);
  const dir = path.join(UPLOADS_DIR, safeProductId);
  await fs.mkdir(dir, { recursive: true });

  const outputPath = path.join(dir, `${safeImageId}.webp`);
  await sharp(bytes)
    .resize(512, 512, { fit: "cover" })
    .webp()
    .toFile(outputPath);

  return `/uploads/products/${safeProductId}/${safeImageId}.webp`;
}

export async function deleteProductImageFile(url: string): Promise<void> {
  if (!url.startsWith("/uploads/products/")) return;
  const relative = url.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", relative);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "products");
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(uploadsRoot))) return;
  try {
    await fs.unlink(resolved);
  } catch {
    // best-effort
  }
}
