# Square Market Phase 1 (Board + Auth + Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable Phase 1 app: email/password auth, a full-viewport 50×50 canvas board (all unsold), button-only zoom, and a square detail panel with live platform ask + Fair/Balanced/Unfair comment.

**Architecture:** Next.js App Router full-stack app with Prisma/PostgreSQL. Pure TypeScript pricing module drives quotes. Homepage is a Canvas board that loads a board snapshot API; selecting a cell opens a panel fed by a square detail API. Auth via Auth.js (NextAuth v5) Credentials provider. No Stripe, uploads, listings, or dashboard in this phase.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma, PostgreSQL, Auth.js (NextAuth v5), bcryptjs, Vitest, Tailwind CSS.

## Global Constraints

- Grid: exactly **50×50 (2,500)** squares; coordinates `x,y` integers **0–49**.
- Light theme; homepage first viewport is **grid-dominant** with minimal floating chrome.
- Zoom only via on-screen **+ / −** and fit/reset — not pinch/scroll as the control model.
- All squares start **unsold** (`status = platform`).
- Currency **USD** cents internally; base location price edge ≈ **$5**, center ≈ **$100**.
- Price labels: **Fair** ±10%, **Balanced** >10% and ≤25%, **Unfair** >25% vs suggested.
- Auth v1: **email + password** only (no OAuth).
- Out of Phase 1: Stripe, Connect, image/link upload, secondary market, auctions, dashboard pages.
- Spec: `docs/superpowers/specs/2026-09-10-square-market-design.md`.
- Commits: conventional commits; author `Cam <slahmaid@gmail.com>` via `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env (do not run `git config`).

---

## File structure (create in this phase)

```
package.json
vitest.config.ts
.env.example
prisma/schema.prisma
prisma/seed.ts
src/lib/db.ts
src/lib/pricing/constants.ts
src/lib/pricing/locationPrice.ts
src/lib/pricing/priceComment.ts
src/lib/pricing/quoteSquare.ts
src/lib/pricing/index.ts
src/lib/auth.ts
src/lib/auth-credentials.ts
src/app/api/auth/[...nextauth]/route.ts
src/app/api/auth/register/route.ts
src/app/api/squares/route.ts
src/app/api/squares/[id]/route.ts
src/app/layout.tsx
src/app/globals.css
src/app/page.tsx
src/app/login/page.tsx
src/app/register/page.tsx
src/components/board/BoardCanvas.tsx
src/components/board/ZoomControls.tsx
src/components/board/SquarePanel.tsx
src/components/board/BoardChrome.tsx
src/components/board/useBoardCamera.ts
tests/pricing/locationPrice.test.ts
tests/pricing/priceComment.test.ts
tests/pricing/quoteSquare.test.ts
tests/auth/register.test.ts
```

---

### Task 1: Scaffold Next.js app + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.env.example`, `.gitignore`
- Test: smoke via `npm test` (empty suite ok after config) and `npm run build` later

**Interfaces:**
- Produces: runnable Next.js + Vitest project root

- [ ] **Step 1: Create Next.js TypeScript app in the repo root**

From `C:\Users\PC\Downloads\Nouveau dossier (9)` (keep existing `docs/` and `.git`):

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack false
```

If create-next-app refuses non-empty dir, scaffold into a temp folder and move app files into root without deleting `docs/`.

- [ ] **Step 2: Add Vitest + test script**

```bash
npm install -D vitest @vitejs/plugin-react jsdom
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

In `package.json` scripts add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add `.env.example`**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/square_market?schema=public"
AUTH_SECRET="generate-a-long-random-string"
AUTH_URL="http://localhost:3000"
```

- [ ] **Step 4: Verify Vitest runs**

```bash
npm test
```

Expected: Vitest exits 0 with `No test files found` or 0 tests — not a crash. If Vitest errors on zero files, add `tests/smoke.test.ts`:

```ts
import { expect, test } from "vitest";
test("smoke", () => expect(1 + 1).toBe(2));
```

- [ ] **Step 5: Commit**

```bash
git add -A
GIT_AUTHOR_NAME="Cam" GIT_AUTHOR_EMAIL="slahmaid@gmail.com" GIT_COMMITTER_NAME="Cam" GIT_COMMITTER_EMAIL="slahmaid@gmail.com" git commit -m "chore: scaffold Next.js app with Vitest"
```

On Windows PowerShell use:

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Prisma schema, client, and 2,500-square seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`
- Modify: `package.json` (prisma seed config)

**Interfaces:**
- Produces: `prisma.square`, `prisma.user`, `prisma.priceQuote`; seed creates 2500 `platform` squares
- Consumes: `DATABASE_URL`

- [ ] **Step 1: Install Prisma**

```bash
npm install @prisma/client
npm install -D prisma tsx
npx prisma init
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SquareStatus {
  platform
  owned
  listed
}

enum PriceLabel {
  fair
  balanced
  unfair
}

model User {
  id                         String   @id @default(cuid())
  email                      String   @unique
  passwordHash               String
  createdAt                  DateTime @default(now())
  stripeCustomerId           String?
  stripeConnectAccountId     String?
  connectOnboardingComplete  Boolean  @default(false)
  squares                    Square[] @relation("SquareOwner")
}

model Square {
  id             String       @id @default(cuid())
  x              Int
  y              Int
  status         SquareStatus @default(platform)
  ownerId        String?
  owner          User?        @relation("SquareOwner", fields: [ownerId], references: [id])
  imageUrl       String?
  linkUrl        String?
  listPriceCents Int?
  priceQuote     PriceQuote?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([x, y])
  @@index([status])
}

model PriceQuote {
  id                  String     @id @default(cuid())
  squareId            String     @unique
  square              Square     @relation(fields: [squareId], references: [id], onDelete: Cascade)
  suggestedPriceCents Int
  label               PriceLabel
  reason              String
  computedAt          DateTime   @default(now())
}
```

- [ ] **Step 3: Create `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Write `prisma/seed.ts`**

```ts
import { PrismaClient, SquareStatus } from "@prisma/client";

const prisma = new PrismaClient();
const GRID = 50;

async function main() {
  const count = await prisma.square.count();
  if (count >= GRID * GRID) {
    console.log(`Seed skip: already have ${count} squares`);
    return;
  }

  const rows: { x: number; y: number; status: SquareStatus }[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      rows.push({ x, y, status: SquareStatus.platform });
    }
  }

  // createMany in chunks to avoid payload limits
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    await prisma.square.createMany({
      data: rows.slice(i, i + chunk),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${await prisma.square.count()} squares`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Add to `package.json`:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 5: Migrate and seed**

Ensure PostgreSQL is running and `.env` has a valid `DATABASE_URL`, then:

```bash
npx prisma migrate dev --name init_squares_users
npx prisma db seed
```

Expected seed log: `Seeded 2500 squares`.

Verify:

```bash
npx prisma db execute --stdin
```

Or with a quick script / Prisma Studio: square count = 2500, all `platform`.

- [ ] **Step 6: Commit**

```powershell
git add prisma src/lib/db.ts package.json package-lock.json
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add Prisma schema and seed 2500 platform squares"
```

---

### Task 3: Location base price (pure)

**Files:**
- Create: `src/lib/pricing/constants.ts`, `src/lib/pricing/locationPrice.ts`
- Test: `tests/pricing/locationPrice.test.ts`

**Interfaces:**
- Produces: `baseLocationPriceCents(x: number, y: number): number`
- Consumes: grid size 50, edge $5, center $100

- [ ] **Step 1: Write failing tests**

`tests/pricing/locationPrice.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baseLocationPriceCents } from "@/lib/pricing/locationPrice";

describe("baseLocationPriceCents", () => {
  it("prices dead center near $100", () => {
    // cells (24,24), (24,25), (25,24), (25,25) are closest to 24.5,24.5
    const p = baseLocationPriceCents(24, 24);
    expect(p).toBeGreaterThanOrEqual(9500);
    expect(p).toBeLessThanOrEqual(10000);
  });

  it("prices a corner near $5", () => {
    const p = baseLocationPriceCents(0, 0);
    expect(p).toBeGreaterThanOrEqual(500);
    expect(p).toBeLessThanOrEqual(800);
  });

  it("prices edge mid-side cheaper than center", () => {
    expect(baseLocationPriceCents(0, 25)).toBeLessThan(baseLocationPriceCents(25, 25));
  });

  it("returns integer cents", () => {
    expect(Number.isInteger(baseLocationPriceCents(10, 10))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/pricing/locationPrice.test.ts
```

Expected: FAIL (module not found or function undefined).

- [ ] **Step 3: Implement**

`src/lib/pricing/constants.ts`:

```ts
export const GRID_SIZE = 50;
export const CENTER = (GRID_SIZE - 1) / 2; // 24.5
export const EDGE_PRICE_CENTS = 500; // $5
export const CENTER_PRICE_CENTS = 10000; // $100
export const FAIR_BAND = 0.1;
export const BALANCED_BAND = 0.25;
```

`src/lib/pricing/locationPrice.ts`:

```ts
import {
  CENTER,
  CENTER_PRICE_CENTS,
  EDGE_PRICE_CENTS,
  GRID_SIZE,
} from "./constants";

/** Max distance from center to a corner in grid units. */
function maxCenterDistance(): number {
  return Math.hypot(CENTER - 0, CENTER - 0);
}

/**
 * Smooth falloff: center ≈ $100, edge/corner ≈ $5.
 * Uses normalized distance from (24.5, 24.5) with ease-out curve.
 */
export function baseLocationPriceCents(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
    throw new Error(`coords out of range: ${x},${y}`);
  }
  const d = Math.hypot(x - CENTER, y - CENTER);
  const t = Math.min(1, Math.max(0, d / maxCenterDistance()));
  // ease: keep center high longer, drop toward edges
  const eased = t * t;
  const price =
    CENTER_PRICE_CENTS -
    eased * (CENTER_PRICE_CENTS - EDGE_PRICE_CENTS);
  return Math.round(price);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/pricing/locationPrice.test.ts
```

Expected: all PASS. If corner is slightly outside 500–800 because of ease curve, widen the corner assertion slightly or tweak easing — keep center ≥ $95 and corner ≤ $8.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pricing tests/pricing/locationPrice.test.ts
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add location-based square base pricing"
```

---

### Task 4: Price comment labels (pure)

**Files:**
- Create: `src/lib/pricing/priceComment.ts`
- Test: `tests/pricing/priceComment.test.ts`

**Interfaces:**
- Produces: `classifyPrice(askCents, suggestedCents) => { label, reason }`
- Labels: `fair` | `balanced` | `unfair` per Global Constraints bands

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { classifyPrice } from "@/lib/pricing/priceComment";

describe("classifyPrice", () => {
  it("marks within 10% as fair", () => {
    const r = classifyPrice(10000, 10000);
    expect(r.label).toBe("fair");
  });

  it("marks 15% over as balanced", () => {
    const r = classifyPrice(11500, 10000);
    expect(r.label).toBe("balanced");
  });

  it("marks 30% over as unfair", () => {
    const r = classifyPrice(13000, 10000);
    expect(r.label).toBe("unfair");
  });

  it("marks 30% under as unfair", () => {
    const r = classifyPrice(7000, 10000);
    expect(r.label).toBe("unfair");
  });

  it("includes a non-empty reason", () => {
    expect(classifyPrice(10000, 10000).reason.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/pricing/priceComment.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { BALANCED_BAND, FAIR_BAND } from "./constants";

export type PriceLabelName = "fair" | "balanced" | "unfair";

export function classifyPrice(
  askCents: number,
  suggestedCents: number,
): { label: PriceLabelName; reason: string } {
  if (suggestedCents <= 0) {
    return { label: "fair", reason: "No market suggestion yet." };
  }
  const delta = (askCents - suggestedCents) / suggestedCents;
  const abs = Math.abs(delta);
  const direction = delta > 0 ? "above" : delta < 0 ? "below" : "at";

  if (abs <= FAIR_BAND) {
    return {
      label: "fair",
      reason: `Ask is ${direction} suggested value within 10%.`,
    };
  }
  if (abs <= BALANCED_BAND) {
    return {
      label: "balanced",
      reason: `Ask is ${direction} suggested value (${Math.round(abs * 100)}%).`,
    };
  }
  return {
    label: "unfair",
    reason: `Ask is clearly ${direction} suggested value (${Math.round(abs * 100)}%).`,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- tests/pricing/priceComment.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pricing/priceComment.ts tests/pricing/priceComment.test.ts
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add Fair/Balanced/Unfair price classification"
```

---

### Task 5: Phase-1 quote builder (location only + stub dynamics hooks)

**Files:**
- Create: `src/lib/pricing/quoteSquare.ts`, `src/lib/pricing/index.ts`
- Test: `tests/pricing/quoteSquare.test.ts`

**Interfaces:**
- Produces: `buildPlatformQuote(input) => { suggestedPriceCents, askCents, label, reason }`
- Phase 1: suggested = location base; ask = suggested (all platform). Dynamic multipliers default to `1` via optional `multipliers` arg for later phases.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildPlatformQuote } from "@/lib/pricing/quoteSquare";

describe("buildPlatformQuote", () => {
  it("uses location price as ask for platform square", () => {
    const q = buildPlatformQuote({ x: 24, y: 24 });
    expect(q.askCents).toBe(q.suggestedPriceCents);
    expect(q.label).toBe("fair");
  });

  it("corner ask near $5", () => {
    const q = buildPlatformQuote({ x: 0, y: 0 });
    expect(q.askCents).toBeGreaterThanOrEqual(500);
    expect(q.askCents).toBeLessThanOrEqual(800);
  });

  it("applies multiplier when provided", () => {
    const base = buildPlatformQuote({ x: 10, y: 10 });
    const hot = buildPlatformQuote({ x: 10, y: 10, multipliers: { neighbor: 1.2 } });
    expect(hot.suggestedPriceCents).toBe(Math.round(base.suggestedPriceCents * 1.2));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/pricing/quoteSquare.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { baseLocationPriceCents } from "./locationPrice";
import { classifyPrice, type PriceLabelName } from "./priceComment";

export type QuoteMultipliers = {
  neighbor?: number;
  velocity?: number;
  scarcity?: number;
  competition?: number;
  timeDecay?: number;
  liquidity?: number;
};

export type PlatformQuote = {
  suggestedPriceCents: number;
  askCents: number;
  label: PriceLabelName;
  reason: string;
};

function product(m: QuoteMultipliers | undefined): number {
  if (!m) return 1;
  return (
    (m.neighbor ?? 1) *
    (m.velocity ?? 1) *
    (m.scarcity ?? 1) *
    (m.competition ?? 1) *
    (m.timeDecay ?? 1) *
    (m.liquidity ?? 1)
  );
}

export function buildPlatformQuote(input: {
  x: number;
  y: number;
  multipliers?: QuoteMultipliers;
}): PlatformQuote {
  const base = baseLocationPriceCents(input.x, input.y);
  const suggestedPriceCents = Math.max(100, Math.round(base * product(input.multipliers)));
  const askCents = suggestedPriceCents; // Phase 1: platform ask = suggestion
  const { label, reason } = classifyPrice(askCents, suggestedPriceCents);
  return { suggestedPriceCents, askCents, label, reason };
}
```

`src/lib/pricing/index.ts`:

```ts
export * from "./constants";
export * from "./locationPrice";
export * from "./priceComment";
export * from "./quoteSquare";
```

- [ ] **Step 4: Run all pricing tests**

```bash
npm test -- tests/pricing
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pricing tests/pricing
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add platform quote builder for Phase 1"
```

---

### Task 6: Auth.js credentials + register API

**Files:**
- Create: `src/lib/auth-credentials.ts`, `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/register/route.ts`
- Test: `tests/auth/register.test.ts` (password hashing helper unit test)

**Interfaces:**
- Produces: `hashPassword`, `verifyPassword`, `handlers` / `auth` / `signIn` / `signOut` from Auth.js
- `POST /api/auth/register` body `{ email, password }` → `201` or `409`

- [ ] **Step 1: Install deps**

```bash
npm install next-auth@5 bcryptjs zod
npm install -D @types/bcryptjs
```

Note: install the current Auth.js / NextAuth v5 package name available at implement time (`next-auth@beta` if required). Use Credentials provider.

- [ ] **Step 2: Write password helper test**

`src/lib/auth-credentials.ts` will export hash/verify. Test first:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-credentials";

describe("auth-credentials", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("Secret123!");
    expect(hash).not.toBe("Secret123!");
    expect(await verifyPassword("Secret123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run — expect FAIL, then implement helper**

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
```

```bash
npm test -- tests/auth/register.test.ts
```

Expected: PASS.

- [ ] **Step 4: Implement Auth.js config `src/lib/auth.ts`**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-credentials";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.sub = user.id;
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
```

Add `src/types/next-auth.d.ts`:

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  }
}
```

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Register route**

`src/app/api/auth/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth-credentials";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });
  return NextResponse.json(user, { status: 201 });
}
```

Ensure `AUTH_SECRET` is set in `.env`.

- [ ] **Step 6: Manual API check**

```bash
curl -s -X POST http://localhost:3000/api/auth/register -H "content-type: application/json" -d "{\"email\":\"cam@example.com\",\"password\":\"Secret123!\"}"
```

Expected: `201` with `id` + `email`. Second identical call → `409`.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/auth.ts src/lib/auth-credentials.ts src/app/api/auth src/types tests/auth
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add email/password auth and register API"
```

---

### Task 7: Login / register pages

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/register/page.tsx`
- Modify: `src/app/layout.tsx` (light theme shell)

**Interfaces:**
- Consumes: `POST /api/auth/register`, Auth.js `signIn("credentials")`
- Produces: working `/login` and `/register` UI

- [ ] **Step 1: Register page (client form)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      setPending(false);
      return;
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (login?.error) {
      setError("Registered but login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f9] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 shadow-sm border border-black/5">
        <h1 className="text-xl font-semibold text-neutral-900">Create account</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="w-full border px-3 py-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border px-3 py-2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8)" />
        <button disabled={pending} className="w-full bg-neutral-900 text-white py-2">{pending ? "…" : "Register"}</button>
        <p className="text-sm text-neutral-600">Have an account? <Link href="/login">Log in</Link></p>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Login page**

Same layout; call `signIn("credentials", { email, password, redirect: false })` only; link to `/register`.

- [ ] **Step 3: Wrap app with SessionProvider**

Create `src/components/providers/SessionProvider.tsx`:

```tsx
"use client";
import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

In `layout.tsx`, wrap `children` with `AuthSessionProvider`. Keep light background `#f6f7f9`.

- [ ] **Step 4: Manual check**

`npm run dev` → register → lands on `/` → logout path optional for Phase 1 via chrome later → login works.

- [ ] **Step 5: Commit**

```powershell
git add src/app/login src/app/register src/components/providers src/app/layout.tsx
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add login and register pages"
```

---

### Task 8: Squares board + detail APIs

**Files:**
- Create: `src/app/api/squares/route.ts`, `src/app/api/squares/[id]/route.ts`

**Interfaces:**
- `GET /api/squares` → `{ squares: Array<{ id, x, y, status, imageUrl }> }` (compact for canvas)
- `GET /api/squares/:id` → square + `{ askCents, suggestedPriceCents, label, reason }` from `buildPlatformQuote`
- Upserts `PriceQuote` row on detail fetch (cache for later phases)

- [ ] **Step 1: Implement list route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const squares = await prisma.square.findMany({
    select: { id: true, x: true, y: true, status: true, imageUrl: true },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });
  return NextResponse.json({ squares });
}
```

- [ ] **Step 2: Implement detail route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPlatformQuote } from "@/lib/pricing";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const square = await prisma.square.findUnique({ where: { id } });
  if (!square) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = buildPlatformQuote({ x: square.x, y: square.y });

  await prisma.priceQuote.upsert({
    where: { squareId: square.id },
    create: {
      squareId: square.id,
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
    },
    update: {
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
      computedAt: new Date(),
    },
  });

  return NextResponse.json({
    square: {
      id: square.id,
      x: square.x,
      y: square.y,
      status: square.status,
      imageUrl: square.imageUrl,
      linkUrl: square.linkUrl,
      listPriceCents: square.listPriceCents,
      ownerId: square.ownerId,
    },
    quote: {
      askCents: quote.askCents,
      suggestedPriceCents: quote.suggestedPriceCents,
      label: quote.label,
      reason: quote.reason,
    },
  });
}
```

- [ ] **Step 3: Manual verify**

```bash
curl -s http://localhost:3000/api/squares | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(j.squares.length)})"
```

Expected: `2500`.

Pick one id from response and `GET /api/squares/:id` — expect `quote.label === "fair"` for platform ask.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/squares
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add squares list and detail quote APIs"
```

---

### Task 9: Board camera hook + zoom controls

**Files:**
- Create: `src/components/board/useBoardCamera.ts`, `src/components/board/ZoomControls.tsx`

**Interfaces:**
- Produces: `{ scale, offsetX, offsetY, zoomIn, zoomOut, fitToView, onResize }`
- Fit maps full 50×50 into viewport; zoom steps multiply scale by `1.25` / `0.8`, clamped

- [ ] **Step 1: Implement `useBoardCamera.ts`**

```ts
"use client";

import { useCallback, useState } from "react";
import { GRID_SIZE } from "@/lib/pricing/constants";

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const STEP = 1.25;

export function useBoardCamera(cellPx: number) {
  const boardPx = GRID_SIZE * cellPx;
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const fitToView = useCallback(
    (viewW: number, viewH: number) => {
      const s = Math.min(viewW / boardPx, viewH / boardPx);
      setScale(s);
      setOffsetX((viewW - boardPx * s) / 2);
      setOffsetY((viewH - boardPx * s) / 2);
    },
    [boardPx],
  );

  const zoomAtCenter = useCallback(
    (factor: number, viewW: number, viewH: number) => {
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        const cx = viewW / 2;
        const cy = viewH / 2;
        setOffsetX((ox) => cx - ((cx - ox) / prev) * next);
        setOffsetY((oy) => cy - ((cy - oy) / prev) * next);
        return next;
      });
    },
    [],
  );

  const zoomIn = (viewW: number, viewH: number) => zoomAtCenter(STEP, viewW, viewH);
  const zoomOut = (viewW: number, viewH: number) => zoomAtCenter(1 / STEP, viewW, viewH);

  return { scale, offsetX, offsetY, fitToView, zoomIn, zoomOut, setOffsetX, setOffsetY };
}
```

- [ ] **Step 2: ZoomControls UI**

Light floating buttons: `−`, `Fit`, `+`. Call props `onZoomIn`, `onZoomOut`, `onFit`.

- [ ] **Step 3: Commit**

```powershell
git add src/components/board/useBoardCamera.ts src/components/board/ZoomControls.tsx
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add board camera and zoom controls"
```

---

### Task 10: BoardCanvas (homepage grid)

**Files:**
- Create: `src/components/board/BoardCanvas.tsx`

**Interfaces:**
- Consumes: `squares` from `/api/squares`, camera from Task 9
- Produces: full-viewport canvas; click → `onSelect(squareId)`; draws light empty cells; optional `imageUrl` when present (none in Phase 1 seed)
- Prevent default wheel zoom (`preventDefault` on wheel); pan optional via drag for usability when zoomed — zoom magnitude only changes via buttons

- [ ] **Step 1: Implement canvas**

Core behavior:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { GRID_SIZE } from "@/lib/pricing/constants";

export type BoardSquare = {
  id: string;
  x: number;
  y: number;
  status: string;
  imageUrl: string | null;
};

type Props = {
  squares: BoardSquare[];
  cellPx?: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onViewport: (w: number, h: number) => void;
};

export function BoardCanvas({
  squares,
  cellPx = 12,
  scale,
  offsetX,
  offsetY,
  selectedId,
  onSelect,
  onViewport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef<Map<string, BoardSquare>>(new Map());

  useEffect(() => {
    const map = new Map<string, BoardSquare>();
    for (const s of squares) map.set(`${s.x},${s.y}`, s);
    indexRef.current = map;
  }, [squares]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      onViewport(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f6f7f9";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const s = indexRef.current.get(`${x},${y}`);
          const px = x * cellPx;
          const py = y * cellPx;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px, py, cellPx, cellPx);
          ctx.strokeStyle = "#e6e8ec";
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(px, py, cellPx, cellPx);
          if (s?.id === selectedId) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
          }
        }
      }
      ctx.restore();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [squares, scale, offsetX, offsetY, selectedId, cellPx, onViewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const bx = (mx - offsetX) / scale;
    const by = (my - offsetY) / scale;
    const x = Math.floor(bx / cellPx);
    const y = Math.floor(by / cellPx);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
    const s = indexRef.current.get(`${x},${y}`);
    if (s) onSelect(s.id);
  }

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full touch-none"
      onClick={handleClick}
      role="img"
      aria-label="Square market board"
    />
  );
}
```

- [ ] **Step 2: Visual check**

Homepage temporary mount: full viewport white grid 50×50, fits on load, click highlights cell, wheel does not zoom.

- [ ] **Step 3: Commit**

```powershell
git add src/components/board/BoardCanvas.tsx
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: render 50x50 board canvas with click select"
```

---

### Task 11: SquarePanel + BoardChrome

**Files:**
- Create: `src/components/board/SquarePanel.tsx`, `src/components/board/BoardChrome.tsx`

**Interfaces:**
- `SquarePanel`: fetches `/api/squares/:id`, shows coords, status, ask USD, label + reason; Buy button disabled with copy “Buying comes in Phase 2” (or links to login if logged out — still no Stripe)
- `BoardChrome`: floating zoom controls + Login / email / link to `/login`

- [ ] **Step 1: SquarePanel**

```tsx
"use client";

import { useEffect, useState } from "react";

type Detail = {
  square: { id: string; x: number; y: number; status: string };
  quote: {
    askCents: number;
    suggestedPriceCents: number;
    label: string;
    reason: string;
  };
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function SquarePanel({
  squareId,
  onClose,
}: {
  squareId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!squareId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setError(null);
    fetch(`/api/squares/${squareId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load square");
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [squareId]);

  if (!squareId) return null;

  return (
    <aside className="fixed z-20 right-0 top-0 h-full w-full max-w-md bg-white border-l border-black/10 p-5 shadow-lg md:top-0 max-md:top-auto max-md:bottom-0 max-md:h-auto max-md:max-h-[55vh] max-md:right-0 max-md:left-0 max-md:border-l-0 max-md:border-t">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Square</h2>
        <button type="button" onClick={onClose} className="text-neutral-500">Close</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-neutral-500">Loading…</p>}
      {data && (
        <div className="mt-4 space-y-3 text-sm text-neutral-800">
          <p>Coords: ({data.square.x}, {data.square.y})</p>
          <p>Status: {data.square.status}</p>
          <p className="text-base font-medium">{formatUsd(data.quote.askCents)}</p>
          <p>
            <span className="uppercase tracking-wide text-xs font-semibold">{data.quote.label}</span>
            {" — "}
            {data.quote.reason}
          </p>
          <button type="button" disabled className="w-full bg-neutral-200 text-neutral-600 py-2 cursor-not-allowed">
            Buy (Phase 2)
          </button>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: BoardChrome**

Use `useSession` from `next-auth/react`: show email or Login/Register links; render `ZoomControls`.

- [ ] **Step 3: Commit**

```powershell
git add src/components/board/SquarePanel.tsx src/components/board/BoardChrome.tsx
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add square detail panel and board chrome"
```

---

### Task 12: Wire homepage and Phase 1 acceptance

**Files:**
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Homepage composes fetch → camera fit on first viewport → canvas → chrome → panel

- [ ] **Step 1: Implement `page.tsx` as client board shell**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { BoardCanvas, type BoardSquare } from "@/components/board/BoardCanvas";
import { BoardChrome } from "@/components/board/BoardChrome";
import { SquarePanel } from "@/components/board/SquarePanel";
import { useBoardCamera } from "@/components/board/useBoardCamera";

const CELL = 12;

export default function HomePage() {
  const [squares, setSquares] = useState<BoardSquare[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const camera = useBoardCamera(CELL);
  const fitted = useState(false);

  useEffect(() => {
    fetch("/api/squares")
      .then((r) => r.json())
      .then((d) => setSquares(d.squares ?? []));
  }, []);

  const onViewport = useCallback(
    (w: number, h: number) => {
      setView({ w, h });
      if (!fitted[0] && w > 0 && h > 0) {
        camera.fitToView(w, h);
        fitted[1](true);
      }
    },
    [camera, fitted],
  );

  // Prefer a ref flag for "hasFitted" in real implementation to avoid stale closure;
  // use useRef(false) instead of useState tuple if needed.

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#f6f7f9]">
      <BoardCanvas
        squares={squares}
        cellPx={CELL}
        scale={camera.scale}
        offsetX={camera.offsetX}
        offsetY={camera.offsetY}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onViewport={onViewport}
      />
      <BoardChrome
        onZoomIn={() => camera.zoomIn(view.w, view.h)}
        onZoomOut={() => camera.zoomOut(view.w, view.h)}
        onFit={() => camera.fitToView(view.w, view.h)}
      />
      <SquarePanel squareId={selectedId} onClose={() => setSelectedId(null)} />
    </main>
  );
}
```

Implementer must replace the `fitted` useState-tuple anti-pattern with `useRef(false)` for first fit.

- [ ] **Step 2: Acceptance checklist (manual)**

1. `npm test` — all pricing + auth unit tests PASS.
2. `npm run dev` — homepage shows full 50×50 light grid fitting viewport (desktop + narrow mobile).
3. `+` / `−` / Fit change zoom; mouse wheel does not zoom the board.
4. Click square → panel shows coords, `platform`, ~fair price, Fair label.
5. Corner square ask ≈ $5; near-center ≈ $100.
6. Register + login works; chrome shows session email.
7. Buy button visible but not charging money (Phase 2).

- [ ] **Step 3: Commit**

```powershell
git add src/app/page.tsx src/app/globals.css src/components/board
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"; $env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: wire Phase 1 homepage board experience"
```

---

## Plan self-review

1. **Spec coverage (Phase 1 only):** Auth email/password ✓ — canvas homepage ✓ — zoom buttons + fit ✓ — square panel with price comment ✓ — all unsold via seed ✓ — light theme ✓ — USD/location bands ✓. Stripe/uploads/dashboard/auctions correctly deferred.
2. **Placeholders:** No TBD tasks; homepage note calls out replacing fitted flag with `useRef`.
3. **Type consistency:** `buildPlatformQuote`, `BoardSquare`, `PriceLabel` / `fair|balanced|unfair` aligned across tasks.
4. **Scope:** This plan is Phase 1 only; Phases 2–4 need separate plans after this ships.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-10-square-market-phase-1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
