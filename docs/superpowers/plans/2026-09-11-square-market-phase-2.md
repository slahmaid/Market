# Square Market Phase 2 (Primary Buy + Customize) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users buy unsold platform squares with Stripe Checkout (USD test mode), transfer ownership via idempotent webhooks, then upload a tiny image and optional https link for their square.

**Architecture:** Extend the existing Next.js + Prisma + Auth.js app. Checkout Session creation is auth-gated; Stripe webhooks finalize ownership in a transactional DB update. Images are stored under `public/uploads/squares/` behind a small storage helper (swap to R2/S3 later without changing callers). Secondary market / Connect / auctions stay out of scope.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Auth.js, Stripe Checkout + webhooks (`stripe` SDK), Vitest, local disk uploads (JPEG/PNG/WebP ≤128×128 after resize).

## Global Constraints

- Currency **USD**; amounts in **cents**.
- Primary sale: platform → user; platform receives full ask (minus Stripe fees).
- Only `status = platform` squares are buyable in this phase.
- Ownership transfer happens **only** after verified Stripe webhook (`checkout.session.completed`).
- Webhooks must be **idempotent** (no double-assign on retries).
- Race: first successful payment wins; loser refunded / session fails with already sold.
- Cannot buy your own square (N/A for platform stock, still guard).
- Image: square crop/resize max **128×128**, optional `https` link only.
- Light theme; keep mobile bottom sheet / desktop slide-over patterns.
- Spec: `docs/superpowers/specs/2026-09-10-square-market-design.md` (Phase 2).
- Out of Phase 2: Stripe Connect, secondary listings, auctions, OAuth, crypto, dashboard.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Do not commit `.env` secrets.

---

## File structure (create/modify)

```
prisma/schema.prisma                          # + Transaction model
.env.example                                  # Stripe + upload vars
src/lib/stripe.ts                             # Stripe client
src/lib/ownership.ts                          # pure/helpers for assign + guards
src/lib/storage/squareImage.ts                # save/delete local upload
src/app/api/checkout/primary/route.ts         # POST create Checkout Session
src/app/api/stripe/webhook/route.ts           # POST Stripe webhook
src/app/api/squares/[id]/customize/route.ts   # POST image + link (owner)
src/app/buy/success/page.tsx                  # return URL
src/app/buy/cancel/page.tsx
src/components/board/SquarePanel.tsx          # Buy + customize UI
src/components/board/BoardCanvas.tsx          # draw owned thumbnails
tests/ownership/assignPrimary.test.ts
tests/storage/squareImage.test.ts
```

---

### Task 1: Transaction model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

**Interfaces:**
- Produces: `Transaction` model with `type primary|secondary`, `sellerId` nullable, `feeCents`, `stripeCheckoutSessionId` unique

- [ ] **Step 1: Extend schema**

Add:

```prisma
enum TransactionType {
  primary
  secondary
}

model Transaction {
  id                      String          @id @default(cuid())
  squareId                String
  square                  Square          @relation(fields: [squareId], references: [id])
  buyerId                 String
  buyer                   User            @relation("BuyerTransactions", fields: [buyerId], references: [id])
  sellerId                String?
  seller                  User?           @relation("SellerTransactions", fields: [sellerId], references: [id])
  amountCents             Int
  feeCents                Int             @default(0)
  type                    TransactionType
  stripeCheckoutSessionId String          @unique
  createdAt               DateTime        @default(now())

  @@index([squareId])
  @@index([buyerId])
}
```

Add inverse relations on `User` and `Square`.

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name add_transactions
npx prisma generate
```

Expected: migration applied; client regenerated.

- [ ] **Step 3: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add prisma
git commit -m "feat: add Transaction model for marketplace purchases"
```

---

### Task 2: Stripe client + env

**Files:**
- Create: `src/lib/stripe.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getStripe(): Stripe` singleton

- [ ] **Step 1: Install**

```bash
npm install stripe
```

- [ ] **Step 2: Implement client**

```ts
import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripe) {
    stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  }
  return stripe;
}
```

Use the API version string required by the installed `stripe` package (adjust if TypeScript complains).

- [ ] **Step 3: Update `.env.example`**

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Document: user must add real test keys to local `.env` (never commit).

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json src/lib/stripe.ts .env.example
# commit as Cam via GIT_* env
git commit -m "chore: add Stripe client and env placeholders"
```

---

### Task 3: Ownership assign helper (TDD)

**Files:**
- Create: `src/lib/ownership.ts`
- Test: `tests/ownership/assignPrimary.test.ts`

**Interfaces:**
- Produces: `assertSquareBuyable(square, buyerId)`, `buildPrimaryAssignData(...)`
- DB write stays in webhook route; pure guards + data builders unit-tested

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import { assertSquareBuyable } from "@/lib/ownership";

describe("assertSquareBuyable", () => {
  it("allows platform square for any buyer", () => {
    expect(() =>
      assertSquareBuyable({ status: "platform", ownerId: null }, "user1"),
    ).not.toThrow();
  });

  it("rejects owned square", () => {
    expect(() =>
      assertSquareBuyable({ status: "owned", ownerId: "u2" }, "user1"),
    ).toThrow(/sold|owned/i);
  });

  it("rejects listed square in Phase 2 primary path", () => {
    expect(() =>
      assertSquareBuyable({ status: "listed", ownerId: "u2" }, "user1"),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/ownership/assignPrimary.test.ts
```

- [ ] **Step 3: Implement minimal**

```ts
export type SquareBuySnapshot = {
  status: "platform" | "owned" | "listed";
  ownerId: string | null;
};

export function assertSquareBuyable(
  square: SquareBuySnapshot,
  _buyerId: string,
): void {
  if (square.status !== "platform" || square.ownerId) {
    throw new Error("Square is not available for primary purchase");
  }
}
```

- [ ] **Step 4: Tests PASS + commit**

```powershell
git commit -m "feat: add primary purchase ownership guards"
```

---

### Task 4: Create primary Checkout Session API

**Files:**
- Create: `src/app/api/checkout/primary/route.ts`

**Interfaces:**
- `POST { squareId }` → `{ url }` Checkout Session URL
- Requires session user; loads square; `buildPlatformQuote`; creates Stripe session with `metadata: { squareId, buyerId, type: "primary" }`
- `mode: "payment"`, `success_url` / `cancel_url` from `NEXT_PUBLIC_APP_URL`
- Line item name e.g. `Square (x,y)`, amount = askCents
- Persist nothing yet except optional pending row later — Phase 2: webhook is source of truth; session metadata carries ids

- [ ] **Step 1: Implement route**

Pseudo-structure:

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // parse squareId with zod
  // load square; assertSquareBuyable
  // quote = buildPlatformQuote({ x, y })
  // stripe.checkout.sessions.create({ ... metadata, line_items, success_url, cancel_url })
  // return { url: checkout.url }
}
```

- [ ] **Step 2: Manual check (Stripe test keys required)**

With keys in `.env` and `npm run dev`:

```bash
# while logged in (browser cookie) — or document browser-only test
```

Expected: returns HTTPS checkout URL (or localhost Stripe test).

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: create Stripe Checkout session for primary square buys"
```

---

### Task 5: Stripe webhook → assign ownership

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/lib/ownership.ts` (add `completePrimaryPurchase` using prisma)

**Interfaces:**
- Verifies signature with `STRIPE_WEBHOOK_SECRET`
- On `checkout.session.completed` + `metadata.type === "primary"`:
  1. If `Transaction` with this `stripeCheckoutSessionId` exists → return 200 (idempotent)
  2. Load square; if not `platform`, call Stripe refund on payment_intent and return 200
  3. Else transaction: set square `owned` + `ownerId`, create `Transaction` (`feeCents: 0`, `sellerId: null`)

- [ ] **Step 1: Implement `completePrimaryPurchase` in `ownership.ts`** using prisma `$transaction`

- [ ] **Step 2: Webhook route** — raw body required:

```ts
export const runtime = "nodejs";
// const body = await req.text();
// stripe.webhooks.constructEvent(body, sig, secret)
```

- [ ] **Step 3: Local webhook forward**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Buy in test mode; confirm square `ownerId` set; replay event → no double Transaction.

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat: assign square ownership on Stripe checkout webhook"
```

---

### Task 6: Buy success/cancel pages + panel Buy button

**Files:**
- Create: `src/app/buy/success/page.tsx`, `src/app/buy/cancel/page.tsx`
- Modify: `src/components/board/SquarePanel.tsx`

**Interfaces:**
- Logged-in user on `platform` square: **Buy** calls `POST /api/checkout/primary` then `window.location = url`
- Loading/disabled states; show errors
- After return from Stripe, success page links home; board refresh shows owned state

- [ ] **Step 1: Simple success/cancel pages** (light theme, link ← Board)

- [ ] **Step 2: Wire Buy in SquarePanel** (replace Phase 2 disabled button)

- [ ] **Step 3: Manual E2E with Stripe test card `4242…`**

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat: wire primary Buy button to Stripe Checkout"
```

---

### Task 7: Square image storage helper (TDD)

**Files:**
- Create: `src/lib/storage/squareImage.ts`
- Test: `tests/storage/squareImage.test.ts`
- Create: `public/uploads/squares/.gitkeep`
- Modify: `.gitignore` to allow gitkeep but ignore uploaded binaries: `/public/uploads/squares/**` + `!/public/uploads/squares/.gitkeep`

**Interfaces:**
- `saveSquareImage(squareId, bytes, mime): Promise<string>` → public URL path `/uploads/squares/{id}.webp`
- Resize/crop to max 128×128 (use `sharp` if needed: `npm install sharp`)
- Reject non-image mime types

- [ ] **Step 1–4:** TDD save path + reject invalid; commit `feat: add square image storage helper`

---

### Task 8: Customize API (image + link)

**Files:**
- Create: `src/app/api/squares/[id]/customize/route.ts`

**Interfaces:**
- Auth required; must be owner; `status` in `owned|listed`
- Accept `multipart/form-data`: optional `image` file, optional `linkUrl`
- Validate link with zod `z.string().url().startsWith("https://").nullable()`
- Update `imageUrl` / `linkUrl` on Square

- [ ] **Step 1: Implement route**

- [ ] **Step 2: Manual upload as owner**

- [ ] **Step 3: Commit** `feat: allow owners to set square image and link`

---

### Task 9: Owner customize UI + canvas thumbnails

**Files:**
- Modify: `SquarePanel.tsx` — if session user owns square: show image file input + link field + Save
- Modify: `BoardCanvas.tsx` — when `imageUrl` present, `drawImage` into cell rect (from cache/onload map)
- Modify: paint/cache invalidation when squares’ `imageUrl` changes

**Interfaces:**
- Owned cells show thumbnail; click still opens panel
- Optional: clicking owned cell image area could `window.open(linkUrl)` only from panel button (keep canvas click = select)

- [ ] **Step 1: Panel customize form**

- [ ] **Step 2: Canvas draws images** (load Image objects; rebuild offscreen cache when map updates)

- [ ] **Step 3: Manual verify thumbnail appears after upload**

- [ ] **Step 4: Commit** `feat: show owned square images and customize UI`

---

### Task 10: Phase 2 acceptance

- [ ] **Step 1: Checklist**

1. `npm test` passes  
2. Logged-out user sees Log in to buy  
3. Logged-in user buys platform square via Stripe test Checkout  
4. Webhook assigns ownership; refresh shows `owned`  
5. Second buyer cannot buy same square  
6. Owner uploads ≤128 image + https link  
7. Board shows thumbnail  
8. Replay webhook does not duplicate Transaction  

- [ ] **Step 2: Commit any fixes**

- [ ] **Step 3: Stop** — ready for Phase 3 plan (secondary + Connect)

---

## Plan self-review

1. **Spec coverage (Phase 2):** Stripe primary ✓, webhook ownership ✓, image+link ✓, race/idempotency ✓. Connect/secondary/dashboard excluded ✓  
2. **Placeholders:** Stripe API version string may need adjusting to installed SDK — noted in Task 2  
3. **Types:** `Transaction.stripeCheckoutSessionId` unique matches webhook idempotency key  

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-square-market-phase-2.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  

**2. Inline Execution** — run tasks in this session with checkpoints  

**Which approach?**

Also needed from you before Task 4 works: Stripe **test** keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) in `.env`, plus `stripe listen` for webhooks.
