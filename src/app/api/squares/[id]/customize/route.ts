import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveSquareImage } from "@/lib/storage/squareImage";

type Params = { params: Promise<{ id: string }> };

const CUSTOMIZABLE = new Set(["owned", "listed"]);

/** Cap for a 128×128 tile source; reject before buffering when possible. */
const MAX_UPLOAD_BYTES = 512_000;

/** Empty string clears; omit field to leave unchanged. */
const linkUrlSchema = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .pipe(z.string().url().startsWith("https://").nullable());

function isBadImageError(message: string): boolean {
  return /invalid|unsupported|corrupt|decode|input buffer/i.test(message);
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  const contentLength = req.headers.get("content-length");
  if (contentLength != null) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image too large" },
        { status: 413 },
      );
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const hasImage = formData.has("image");
  const hasLinkUrl = formData.has("linkUrl");

  if (!hasImage && !hasLinkUrl) {
    return NextResponse.json(
      { error: "Provide image and/or linkUrl" },
      { status: 400 },
    );
  }

  let nextLinkUrl: string | null | undefined;
  if (hasLinkUrl) {
    const raw = formData.get("linkUrl");
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid linkUrl" }, { status: 400 });
    }
    const parsed = linkUrlSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "linkUrl must be a https URL or empty" },
        { status: 400 },
      );
    }
    nextLinkUrl = parsed.data;
  }

  const imageEntry = hasImage ? formData.get("image") : null;
  if (hasImage) {
    if (!(imageEntry instanceof File)) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }
    if (imageEntry.size === 0) {
      return NextResponse.json({ error: "Empty image file" }, { status: 400 });
    }
    if (imageEntry.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image too large" },
        { status: 413 },
      );
    }
  }

  let square;
  try {
    square = await prisma.square.findUnique({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  if (!square) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (square.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!CUSTOMIZABLE.has(square.status)) {
    return NextResponse.json(
      { error: "Square cannot be customized in this status" },
      { status: 409 },
    );
  }

  const data: { imageUrl?: string; linkUrl?: string | null } = {};

  if (hasImage && imageEntry instanceof File) {
    const bytes = Buffer.from(await imageEntry.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image too large" },
        { status: 413 },
      );
    }
    const mime = imageEntry.type || "application/octet-stream";
    try {
      data.imageUrl = await saveSquareImage(id, bytes, mime);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save image";
      const status = isBadImageError(message) ? 400 : 500;
      return NextResponse.json(
        { error: status === 400 ? "Invalid image" : message },
        { status },
      );
    }
  }

  if (nextLinkUrl !== undefined) {
    data.linkUrl = nextLinkUrl;
  }

  try {
    const updated = await prisma.square.update({
      where: { id },
      data,
      select: {
        id: true,
        x: true,
        y: true,
        status: true,
        imageUrl: true,
        linkUrl: true,
        ownerId: true,
      },
    });
    return NextResponse.json({ square: updated });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
