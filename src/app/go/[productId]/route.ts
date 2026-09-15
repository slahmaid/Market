import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ productId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { productId } = await params;

  let product: {
    id: string;
    active: boolean;
    buyUrl: string | null;
    storeId: string;
  } | null;

  try {
    product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        active: true,
        buyUrl: true,
        storeId: true,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  if (
    !product ||
    !product.active ||
    !product.buyUrl ||
    !product.buyUrl.startsWith("https://")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.productClick.create({
      data: {
        productId: product.id,
        storeId: product.storeId,
      },
    });
  } catch (e) {
    console.error("productClick create failed", e);
  }

  return NextResponse.redirect(product.buyUrl, 302);
}
