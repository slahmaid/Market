import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertConversationAccess } from "@/lib/chat/assertConversationAccess";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["open", "archived"]),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  const access = await assertConversationAccess(id, session?.user?.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        storeId: conversation.storeId,
        buyerId: conversation.buyerId,
        status: conversation.status,
        updatedAt: conversation.updatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
