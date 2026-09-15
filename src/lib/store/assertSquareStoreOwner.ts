import { prisma } from "@/lib/db";

const OWNER_STATUSES = new Set(["owned", "listed"]);

export type OwnerGate =
  | {
      ok: true;
      square: {
        id: string;
        ownerId: string | null;
        status: string;
      };
      store: {
        id: string;
        squareId: string;
        name: string;
        about: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        hours: string | null;
        websiteUrl: string | null;
      } | null;
    }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function requireSquareStoreOwner(
  squareId: string,
  userId: string | undefined,
): Promise<OwnerGate> {
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const square = await prisma.square.findUnique({
    where: { id: squareId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      store: {
        select: {
          id: true,
          squareId: true,
          name: true,
          about: true,
          email: true,
          phone: true,
          address: true,
          hours: true,
          websiteUrl: true,
        },
      },
    },
  });

  if (!square) {
    return { ok: false, status: 404, error: "Square not found" };
  }

  if (
    square.ownerId !== userId ||
    !OWNER_STATUSES.has(square.status)
  ) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return {
    ok: true,
    square: {
      id: square.id,
      ownerId: square.ownerId,
      status: square.status,
    },
    store: square.store,
  };
}
