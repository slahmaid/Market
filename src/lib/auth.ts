import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { authorizeCredentials } from "@/lib/auth-credentials";
import {
  ensureGoogleUser,
  isGoogleEmailVerified,
} from "@/lib/auth-google";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleConfigured =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            // Product decision Phase 5a: same email = same user
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        return authorizeCredentials(parsed.data);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email ?? profile?.email;
        if (!email || !account.providerAccountId) return false;
        if (
          !isGoogleEmailVerified(
            profile as { email_verified?: boolean } | undefined,
          )
        ) {
          return false;
        }
        const ensured = await ensureGoogleUser({
          email,
          providerAccountId: account.providerAccountId,
        });
        user.id = ensured.id;
      }
      return true;
    },
    jwt: async ({ token, user, account, profile }) => {
      if (account?.provider === "google") {
        const email = user?.email ?? profile?.email ?? token.email;
        const providerAccountId = account.providerAccountId;
        if (email && providerAccountId) {
          const ensured = await ensureGoogleUser({
            email: String(email),
            providerAccountId,
          });
          token.sub = ensured.id;
          return token;
        }
      }
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
