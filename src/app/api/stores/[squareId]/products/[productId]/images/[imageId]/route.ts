import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { deleteProductImageFile } from "@/lib/storage/productImage";

type Params = {
  params: Promise<{ squareId: string; productId: string; imageId: string }>;
};

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  const { squareId, productId, imageId } = await params;

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

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: gate.store.id },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteProductImageFile(image.url);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
