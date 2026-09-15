import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { assertConversationAccess } from "@/lib/chat/assertConversationAccess";
import { prisma } from "@/lib/db";
import ThreadClient from "./thread-client";

type Props = { params: Promise<{ id: string }> };

export default async function MessageThreadPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/messages/${id}`)}`);
  }

  const access = await assertConversationAccess(id, session.user.id);
  if (!access.ok) {
    if (access.status === 404) notFound();
    redirect("/messages");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      store: { select: { name: true, squareId: true } },
      buyer: { select: { email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, senderId: true, body: true, createdAt: true },
      },
    },
  });

  if (!conversation) notFound();

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-900">
      <div className="mx-auto flex max-w-xl flex-col px-4 py-8" style={{ minHeight: "100dvh" }}>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/messages"
            className="text-zinc-600 underline-offset-2 hover:underline"
          >
            ← Inbox
          </Link>
          <Link
            href={`/store/${conversation.store.squareId}`}
            className="text-zinc-600 underline-offset-2 hover:underline"
          >
            {conversation.store.name}
          </Link>
        </div>
        <h1 className="text-xl font-semibold">
          {access.role === "owner"
            ? conversation.buyer.email
            : conversation.store.name}
        </h1>
        <ThreadClient
          conversationId={id}
          role={access.role}
          status={conversation.status}
          currentUserId={session.user.id}
          initialMessages={conversation.messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
