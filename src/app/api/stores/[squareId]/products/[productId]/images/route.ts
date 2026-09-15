import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { saveProductImage } from "@/lib/storage/productImage";

type Params = {
  params: Promise<{ squareId: string; productId: string }>;
};

const MAX_IMAGES = 5;
const MAX_UPLOAD_BYTES = 2_000_000;

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  const { squareId, productId } = await params;

  const gate = await requireSquareStoreOwner(squareId, session?.user?.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!gate.store) {
    return NextResponse.json(
      { error: "Create store profile first" },
      { status: 404 },
    );
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength != null) {
    const len = Number(contentLength);
    if (Number.isFinite(len) && len > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
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

  const entry = formData.get("image");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: gate.store.id },
      include: { images: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (product.images.length >= MAX_IMAGES) {
      return NextResponse.json(
        { error: "Image limit reached" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await entry.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const mime = entry.type || "application/octet-stream";
    const imageId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const url = await saveProductImage(productId, imageId, bytes, mime);
    const sortOrder = product.images.length;

    const image = await prisma.productImage.create({
      data: {
        id: imageId,
        productId,
        url,
        sortOrder,
      },
    });

    return NextResponse.json(
      { image: { id: image.id, url: image.url, sortOrder: image.sortOrder } },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    if (/invalid image type/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
