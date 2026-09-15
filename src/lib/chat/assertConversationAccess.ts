import { prisma } from "@/lib/db";

export type ConversationAccess =
  | {
      ok: true;
      role: "buyer" | "owner";
      conversation: {
        id: string;
        storeId: string;
        buyerId: string;
        status: "open" | "archived";
      };
      ownerId: string;
    }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function assertConversationAccess(
  conversationId: string,
  userId: string | undefined,
): Promise<ConversationAccess> {
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      storeId: true,
      buyerId: true,
      status: true,
      store: {
        select: {
          square: { select: { ownerId: true } },
        },
      },
    },
  });

  if (!conversation || !conversation.store.square.ownerId) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const ownerId = conversation.store.square.ownerId;
  if (userId === conversation.buyerId) {
    return {
      ok: true,
      role: "buyer",
      ownerId,
      conversation: {
        id: conversation.id,
        storeId: conversation.storeId,
        buyerId: conversation.buyerId,
        status: conversation.status,
      },
    };
  }
  if (userId === ownerId) {
    return {
      ok: true,
      role: "owner",
      ownerId,
      conversation: {
        id: conversation.id,
        storeId: conversation.storeId,
        buyerId: conversation.buyerId,
        status: conversation.status,
      },
    };
  }

  return { ok: false, status: 403, error: "Forbidden" };
}
