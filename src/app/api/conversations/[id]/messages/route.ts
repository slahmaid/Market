import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertConversationAccess } from "@/lib/chat/assertConversationAccess";
import { checkRateLimit } from "@/lib/chat/rateLimit";
import { sanitizeMessageBody } from "@/lib/chat/sanitizeMessageBody";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  const access = await assertConversationAccess(id, session?.user?.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(req.url);
  const afterRaw = url.searchParams.get("after");
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 50;

  let afterDate: Date | undefined;
  if (afterRaw) {
    const d = new Date(afterRaw);
    if (!Number.isNaN(d.getTime())) afterDate = d;
  }

  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        senderId: true,
        body: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      conversation: access.conversation,
      role: access.role,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  const access = await assertConversationAccess(id, session?.user?.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (
    access.conversation.status === "archived" &&
    access.role === "buyer"
  ) {
    return NextResponse.json(
      { error: "Conversation archived" },
      { status: 403 },
    );
  }

  const userId = session!.user!.id;
  if (!checkRateLimit(`msg:${userId}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many messages" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = sanitizeMessageBody(
    body && typeof body === "object" && "body" in body
      ? (body as { body: unknown }).body
      : null,
  );
  if (!text) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: id,
          senderId: userId,
          body: text,
        },
      });
      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return msg;
    });

    return NextResponse.json(
      {
        message: {
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
