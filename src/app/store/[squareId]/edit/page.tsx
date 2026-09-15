import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import StoreEditClient from "./store-edit-client";

type Props = { params: Promise<{ squareId: string }> };

export default async function StoreEditPage({ params }: Props) {
  const { squareId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${squareId}/edit`)}`);
  }

  const square = await prisma.square.findUnique({
    where: { id: squareId },
    select: { id: true, ownerId: true, status: true },
  });

  if (
    !square ||
    square.ownerId !== session.user.id ||
    (square.status !== "owned" && square.status !== "listed")
  ) {
    notFound();
  }

  return <StoreEditClient squareId={squareId} />;
}
