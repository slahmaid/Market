import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function authorizeCredentials(input: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (!user?.passwordHash) return null;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email };
}
