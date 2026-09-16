import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import {
  serializeStore,
  serializeStorePayload,
} from "@/lib/store/serializeStore";
import { storeUpsertSchema } from "@/lib/store/storeSchemas";

type Params = { params: Promise<{ squareId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { squareId } = await params;
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";

  try {
    const store = await prisma.store.findUnique({
      where: { squareId },
      include: {
        square: { select: { ownerId: true } },
        products: {
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            _count: { select: { clicks: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    let includeInactive = false;
    let includeClickCount = false;
    let includeEstimatedOwed = false;
    if (mine) {
      const session = await auth();
      if (session?.user?.id && session.user.id === store.square.ownerId) {
        includeInactive = true;
        includeClickCount = true;
        includeEstimatedOwed = true;
      }
    }

    const { square: _square, products, ...storeFields } = store;
    void _square;

    let estimatedOwedCents = 0;
    let productsForPayload = products;

    if (includeEstimatedOwed) {
      const [storeAgg, byProduct] = await Promise.all([
        prisma.productClick.aggregate({
          where: { storeId: store.id },
          _sum: { feeCents: true },
        }),
        prisma.productClick.groupBy({
          by: ["productId"],
          where: { storeId: store.id },
          _sum: { feeCents: true },
        }),
      ]);
      estimatedOwedCents = storeAgg._sum.feeCents ?? 0;
      const owedByProduct = new Map(
        byProduct.map((row) => [row.productId, row._sum.feeCents ?? 0]),
      );
      productsForPayload = products.map((p) => ({
        ...p,
        estimatedOwedCents: owedByProduct.get(p.id) ?? 0,
      }));
    }

    return NextResponse.json(
      serializeStorePayload(storeFields, productsForPayload, {
        includeInactive,
        includeClickCount,
        includeEstimatedOwed,
        estimatedOwedCents,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  const { squareId } = await params;

  const gate = await requireSquareStoreOwner(squareId, session?.user?.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = storeUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid store fields" }, { status: 400 });
  }

  const data = {
    name: parsed.data.name,
    about: parsed.data.about ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
    hours: parsed.data.hours ?? null,
    websiteUrl: parsed.data.websiteUrl ?? null,
  };

  try {
    const store = await prisma.store.upsert({
      where: { squareId },
      create: { squareId, ...data },
      update: data,
    });
    return NextResponse.json({ store: serializeStore(store) });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
