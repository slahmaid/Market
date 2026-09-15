import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { serializeProduct } from "@/lib/store/serializeStore";
import { productPatchSchema } from "@/lib/store/storeSchemas";

type Params = {
  params: Promise<{ squareId: string; productId: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product fields" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId: gate.store.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description;
    }
    if (parsed.data.priceCents !== undefined) {
      data.priceCents = parsed.data.priceCents;
    }
    if (parsed.data.buyUrl !== undefined) data.buyUrl = parsed.data.buyUrl;
    if (parsed.data.active !== undefined) data.active = parsed.data.active;
    if (parsed.data.sortOrder !== undefined) {
      data.sortOrder = parsed.data.sortOrder;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data,
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ product: serializeProduct(product) });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
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

  try {
    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId: gate.store.id },
      include: { images: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
