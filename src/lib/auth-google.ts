import { prisma } from "@/lib/db";

export async function ensureGoogleUser(input: {
  email: string;
  providerAccountId: string;
  name?: string | null;
}): Promise<{ id: string; email: string }> {
  const email = input.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, passwordHash: null },
    });
  }
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: input.providerAccountId,
      },
    },
    create: {
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: input.providerAccountId,
    },
    update: { userId: user.id },
  });
  return { id: user.id, email: user.email };
}
