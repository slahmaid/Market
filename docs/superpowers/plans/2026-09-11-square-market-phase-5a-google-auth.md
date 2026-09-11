# Square Market Phase 5a (Google Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users sign in and register with Google via Auth.js while keeping email/password; same-email Google links to the existing user; Google-only users have no password.

**Architecture:** Keep JWT sessions. Add Auth.js Google provider + Prisma `Account` model. Make `User.passwordHash` nullable. Upsert user/account in Auth.js callbacks. Add “Continue with Google” on login/register pages. No Stripe work.

**Tech Stack:** Next.js 15 App Router, Auth.js (`next-auth` v5), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Same email + Google → **link** to existing `User` (one identity).
- Google-only: `passwordHash` nullable; credentials login must fail clearly when hash is null.
- Session strategy remains **JWT**; `session.user.id` = `user.id`.
- Email stored lowercase / unique.
- Use `allowDangerousEmailAccountLinking: true` on Google with an explicit code comment (product decision).
- Only trust Google when email is present (and verified when Auth.js exposes it).
- Light theme; match existing login/register UI (neutral Google button — not purple pack).
- Spec: `docs/superpowers/specs/2026-09-11-square-market-phase-5a-google-auth-design.md`.
- Out of scope: Stripe, password reset / set-password, other OAuth providers, DB sessions adapter.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Do not commit `.env` secrets.
- Work on branch `feat/phase-5a-google-auth` off `master` unless user directs otherwise.

---

## File structure (create/modify)

```
prisma/schema.prisma                         # passwordHash optional + Account model
prisma/migrations/..._google_auth/           # migrate
.env.example                                 # AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
src/lib/auth.ts                              # Google provider + callbacks
src/lib/auth-google.ts                       # pure helpers: ensureGoogleUser (TDD)
src/app/login/page.tsx                       # Continue with Google
src/app/register/page.tsx                    # Continue with Google
tests/auth/googleLink.test.ts
tests/auth/credentialsNullPassword.test.ts
```

---

### Task 1: Schema — nullable passwordHash + Account

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Interfaces:**
- `User.passwordHash String?`
- `Account` model as in spec (unique `[provider, providerAccountId]`, FK userId, optional token fields)

- [ ] **Step 1: Update schema**

```prisma
model User {
  id                        String    @id @default(cuid())
  email                     String    @unique
  passwordHash              String?
  createdAt                 DateTime  @default(now())
  stripeCustomerId          String?
  stripeConnectAccountId    String?
  connectOnboardingComplete Boolean   @default(false)
  squares                   Square[]  @relation("SquareOwner")
  buyerTransactions         Transaction[] @relation("BuyerTransactions")
  sellerTransactions        Transaction[] @relation("SellerTransactions")
  accounts                  Account[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name google_auth_accounts
npx prisma generate
```

Expected: migration applied; client regenerated. On Windows EPERM, stop Node and re-run generate.

- [ ] **Step 3: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add prisma
git commit -m "feat: allow OAuth users with Account model and optional password"
```

---

### Task 2: ensureGoogleUser helper (TDD)

**Files:**
- Create: `src/lib/auth-google.ts`
- Test: `tests/auth/googleLink.test.ts`

**Interfaces:**
- Produces: `ensureGoogleUser(input): Promise<{ id: string; email: string }>`
- Input: `{ email: string; providerAccountId: string; name?: string | null }` (email already verified by caller)
- Behavior: lowercase email; find user by email; create if missing with `passwordHash: null`; upsert `Account` for `provider: "google"`.

- [ ] **Step 1: Failing tests** (mock prisma or use injectable deps — prefer injecting a minimal db interface if mocking is cleaner)

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ensureGoogleUser } from "@/lib/auth-google";

// Prefer testing pure orchestration with a fake prisma-like object.
```

If the codebase mocks Prisma via `vi.mock("@/lib/db")`, follow that pattern. Minimum cases:

1. Creates new user + account when email unknown.  
2. Links account to existing user with same email (does not create second user).  
3. Idempotent second call same google id (no duplicate account error).

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/auth/googleLink.test.ts
```

- [ ] **Step 3: Implement `ensureGoogleUser`**

```ts
import { prisma } from "@/lib/db";

export async function ensureGoogleUser(input: {
  email: string;
  providerAccountId: string;
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
```

- [ ] **Step 4: PASS + commit**

```powershell
git commit -m "feat: add Google account link helper"
```

---

### Task 3: Credentials reject null password (TDD)

**Files:**
- Modify: `src/lib/auth.ts` (authorize) — or extract `authorizeCredentials` to `src/lib/auth-credentials.ts` for testability
- Test: `tests/auth/credentialsNullPassword.test.ts`

**Interfaces:**
- When user exists with `passwordHash: null`, authorize returns `null`.
- When hash present, existing verifyPassword path unchanged.

- [ ] **Step 1: Extract or test authorize path**

Prefer extracting:

```ts
// src/lib/auth-credentials.ts (extend)
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
```

Wire Credentials provider to call this.

- [ ] **Step 2: Tests for null hash + bad password + success (mock prisma + verifyPassword)**

- [ ] **Step 3: Commit**

```powershell
git commit -m "fix: reject credentials login when no password is set"
```

---

### Task 4: Wire Google provider + Auth.js callbacks

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `.env.example`

**Interfaces:**
- Google provider with `allowDangerousEmailAccountLinking: true` + comment citing Phase 5a decision.
- On Google sign-in (`signIn` or `jwt` when `account.provider === "google"`), call `ensureGoogleUser` and set token.sub to returned id.
- If `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` missing, omit Google provider (app still boots for credentials-only local).

- [ ] **Step 1: Update `.env.example`**

```env
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"
```

- [ ] **Step 2: Implement providers + callbacks in `auth.ts`**

Pseudo:

```ts
import Google from "next-auth/providers/google";
import { ensureGoogleUser } from "@/lib/auth-google";

const googleConfigured =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

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
  Credentials({ ... authorizeCredentials ... }),
],
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === "google") {
      const email = user.email ?? profile?.email;
      if (!email || !account.providerAccountId) return false;
      // If Auth.js exposes email_verified on profile, require true
      const verified =
        (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (verified === false) return false;
      const ensured = await ensureGoogleUser({
        email,
        providerAccountId: account.providerAccountId,
      });
      user.id = ensured.id;
    }
    return true;
  },
  jwt: async ({ token, user }) => {
    if (user?.id) token.sub = user.id;
    return token;
  },
  session: async ({ session, token }) => {
    if (session.user && token.sub) session.user.id = token.sub;
    return session;
  },
},
```

Adjust to Auth.js v5 beta APIs as installed (types may differ slightly — follow compiler).

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: add Google OAuth provider to Auth.js"
```

---

### Task 5: Login + Register UI

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`

**Interfaces:**
- Button “Continue with Google” → `signIn("google", { callbackUrl: "/" })`
- Show only if Google is configured — either always show (fails clearly if unset) **or** pass a server prop. Prefer always show; if provider missing Auth.js errors → map to friendly message.
- Credentials error when Google-only: improve login copy when `signIn` fails after known Google-only is hard without API — optional: change generic invalid message is OK; better: document that null-hash returns same as invalid for security, UI keeps “Invalid email or password” OR add note under Google button: “Used Google before? Continue with Google.”
- Spec preference: show helper text under Google button: “New here? Google creates your account.” on register; on login: “Prefer Google? Use the button above.”

- [ ] **Step 1: Add Google button + divider to both pages**

```tsx
<button
  type="button"
  onClick={() => signIn("google", { callbackUrl: "/" })}
  className="sm-press w-full min-h-12 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 ..."
>
  Continue with Google
</button>
```

- [ ] **Step 2: Manual** — BLOCKED without Google Cloud credentials; note in report.

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: add Continue with Google on login and register"
```

---

### Task 6: Acceptance

- [ ] **Step 1: Checklist**

1. `npm test` passes  
2. `npx tsc --noEmit` clean  
3. Migration applied locally  
4. Credentials still work for password users  
5. Null-password user cannot credentials-login (unit)  
6. ensureGoogleUser creates + links (unit)  
7. Login/register show Google button  
8. Live Google E2E when `AUTH_GOOGLE_*` set (optional / BLOCKED_MANUAL)  
9. No Stripe code changes  

- [ ] **Step 2: Fix gaps; commit if needed**

- [ ] **Step 3: Stop** — ready to merge; Stripe still deferred

---

## Plan self-review

1. **Spec coverage:** Google provider ✓, link same email ✓, nullable password ✓, Account model ✓, UI both pages ✓, env example ✓, JWT kept ✓, Stripe out ✓  
2. **Placeholders:** Live Google depends on user Cloud Console credentials — noted BLOCKED_MANUAL  
3. **Types:** `ensureGoogleUser` → `{ id, email }`; Account unique compound name `provider_providerAccountId` matches Prisma convention  

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-square-market-phase-5a-google-auth.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  

**2. Inline Execution** — run tasks in this session with checkpoints  

**Which approach?**
