import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const squares = await prisma.square.findMany({
      where: {
        ownerId: session.user.id,
        status: { in: ["owned", "listed"] },
      },
      select: {
        id: true,
        x: true,
        y: true,
        status: true,
        imageUrl: true,
        linkUrl: true,
        listPriceCents: true,
      },
      orderBy: [{ y: "asc" }, { x: "asc" }],
    });
    return NextResponse.json({ squares });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
