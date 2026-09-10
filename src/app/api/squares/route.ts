import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const squares = await prisma.square.findMany({
    select: { id: true, x: true, y: true, status: true, imageUrl: true },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });
  return NextResponse.json({ squares });
}
