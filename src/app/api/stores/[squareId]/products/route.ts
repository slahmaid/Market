import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { serializeProduct } from "@/lib/store/serializeStore";
import { productCreateSchema } from "@/lib/store/storeSchemas";

type Params = { params: Promise<{ squareId: string }> };

const MAX_PRODUCTS = 50;

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  const { squareId } = await params;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product fields" },
      { status: 400 },
    );
  }

  try {
    const count = await prisma.product.count({
      where: { storeId: gate.store.id },
    });
    if (count >= MAX_PRODUCTS) {
      return NextResponse.json(
        { error: "Product limit reached" },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        storeId: gate.store.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        priceCents: parsed.data.priceCents,
        buyUrl: parsed.data.buyUrl ?? null,
        active: parsed.data.active ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(
      { product: serializeProduct(product) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
