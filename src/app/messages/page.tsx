import { redirect } from "next/navigation";
import Link from "next/link";
import { AppChrome } from "@/components/board/AppChrome";
import { PageShell } from "@/components/board/PageShell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MessagesInboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/messages");
  }

  const userId = session.user.id;

  const asBuyer = await prisma.conversation.findMany({
    where: { buyerId: userId },
    include: {
      store: { select: { name: true, squareId: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const asOwner = await prisma.conversation.findMany({
    where: { store: { square: { ownerId: userId } } },
    include: {
      store: { select: { name: true, squareId: true } },
      buyer: { select: { email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items = [
    ...asBuyer.map((c) => ({
      id: c.id,
      title: c.store.name,
      subtitle: c.messages[0]?.body ?? "No messages yet",
      status: c.status,
      updatedAt: c.updatedAt,
    })),
    ...asOwner
      .filter((c) => c.buyerId !== userId)
      .map((c) => ({
        id: c.id,
        title: `${c.store.name} ← ${c.buyer.email}`,
        subtitle: c.messages[0]?.body ?? "No messages yet",
        status: c.status,
        updatedAt: c.updatedAt,
      })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9] text-zinc-900">
      <AppChrome active="messages" />
      <PageShell>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        {items.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">No conversations yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/messages/${item.id}`}
                  className="sm-press block px-4 py-3.5 active:bg-zinc-50 touch-manipulation"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    {item.status === "archived" ? (
                      <span className="text-xs text-zinc-500">Archived</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-600">
                    {item.subtitle}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
