# Commission Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let store owners pay the full unpaid click-commission balance via Stripe Checkout, with webhook-credited `CommissionPayment` rows and Pay UI on store edit.

**Architecture:** `CommissionPayment` stores pending/succeeded Checkout amounts. Unpaid = Σ click `feeCents` − Σ succeeded payments. Owner `POST …/commission/checkout` freezes unpaid (≥50¢), creates Stripe Checkout + pending row. Webhook `metadata.type=commission` marks succeeded (idempotent). Owner `mine=1` exposes unpaid as `estimatedOwedCents` plus lifetime/paid/canPay.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Stripe Checkout + existing webhook, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-square-market-commission-collection-design.md`.
- Pay **full unpaid** only; no client-supplied amount.
- `MIN_COMMISSION_CHECKOUT_CENTS = 50`.
- Amount frozen at Checkout create; pending does **not** reduce unpaid.
- Reject new checkout if store has `pending` payment with `createdAt` within last **1 hour** → `409`.
- Webhook: `metadata.type=commission`; amount mismatch → do not succeed + refund (mirror primary helper pattern).
- Store `estimatedOwedCents` on owner payload = **unpaid**; product `estimatedOwedCents` remains per-product fee sum.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Branch: prefer `feat/commission-collection` worktree; do not commit unrelated WIP.

---

## File structure

```
prisma/schema.prisma
prisma/migrations/…_commission_payments/

src/lib/commission/balance.ts              # unpaid math + store balance query
tests/commission/balance.test.ts

src/app/api/stores/[squareId]/commission/checkout/route.ts
tests/store/commissionCheckout.test.ts

src/app/api/stripe/webhook/route.ts          # commission branch
tests/ownership/webhookIdempotency.test.ts # extend OR tests/commission/webhookCommission.test.ts

src/lib/store/serializeStore.ts
src/app/api/stores/[squareId]/route.ts
tests/store/storeApi.test.ts

src/app/store/[squareId]/edit/store-edit-client.tsx
```

---

### Task 1: Prisma `CommissionPayment` + migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev --name commission_payments`

**Interfaces:**
- Produces: `CommissionPayment { id, storeId, amountCents, stripeCheckoutSessionId @unique, status, createdAt, succeededAt? }`
- Produces: `Store.commissionPayments CommissionPayment[]`
- Status values (string): `"pending" | "succeeded" | "canceled"`

- [ ] **Step 1: Add model**

```prisma
model CommissionPayment {
  id                       String    @id @default(cuid())
  storeId                  String
  store                    Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  amountCents              Int
  stripeCheckoutSessionId  String    @unique
  status                   String
  createdAt                DateTime  @default(now())
  succeededAt              DateTime?

  @@index([storeId])
}
```

Add `commissionPayments CommissionPayment[]` on `Store`.

- [ ] **Step 2: Migrate + generate**

If worktree has no `.env`, set `DATABASE_URL` from parent `.env` for the process only (do not commit secrets). Stop `npm run dev` if Prisma generate EPERM on Windows.

```powershell
npx prisma migrate dev --name commission_payments
npx prisma generate
```

- [ ] **Step 3: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add CommissionPayment model for click commission pay"
```

---

### Task 2: Balance helpers (TDD)

**Files:**
- Create: `src/lib/commission/balance.ts`
- Create: `tests/commission/balance.test.ts`

**Interfaces:**
- Produces: `MIN_COMMISSION_CHECKOUT_CENTS = 50`
- Produces: `PENDING_CHECKOUT_GUARD_MS = 60 * 60 * 1000`
- Produces: `computeUnpaidCents(lifetimeFeesCents: number, paidCents: number): number`
- Produces: `canPayCommission(unpaidCents: number): boolean`
- Produces: `getStoreCommissionBalance(storeId: string): Promise<{ lifetimeFeesCents: number; paidCents: number; unpaidCents: number; canPayCommission: boolean }>`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  MIN_COMMISSION_CHECKOUT_CENTS,
  computeUnpaidCents,
  canPayCommission,
} from "@/lib/commission/balance";

describe("computeUnpaidCents", () => {
  it("subtracts paid from fees", () => {
    expect(computeUnpaidCents(200, 50)).toBe(150);
  });

  it("floors at 0 when overpaid", () => {
    expect(computeUnpaidCents(100, 150)).toBe(0);
  });
});

describe("canPayCommission", () => {
  it("false below 50", () => {
    expect(canPayCommission(49)).toBe(false);
    expect(MIN_COMMISSION_CHECKOUT_CENTS).toBe(50);
  });

  it("true at 50+", () => {
    expect(canPayCommission(50)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
npx vitest run tests/commission/balance.test.ts
```

- [ ] **Step 3: Implement**

```ts
import { prisma } from "@/lib/db";

export const MIN_COMMISSION_CHECKOUT_CENTS = 50;
export const PENDING_CHECKOUT_GUARD_MS = 60 * 60 * 1000;

export function computeUnpaidCents(
  lifetimeFeesCents: number,
  paidCents: number,
): number {
  return Math.max(0, lifetimeFeesCents - paidCents);
}

export function canPayCommission(unpaidCents: number): boolean {
  return unpaidCents >= MIN_COMMISSION_CHECKOUT_CENTS;
}

export async function getStoreCommissionBalance(storeId: string): Promise<{
  lifetimeFeesCents: number;
  paidCents: number;
  unpaidCents: number;
  canPayCommission: boolean;
}> {
  const [feeAgg, paidAgg] = await Promise.all([
    prisma.productClick.aggregate({
      where: { storeId },
      _sum: { feeCents: true },
    }),
    prisma.commissionPayment.aggregate({
      where: { storeId, status: "succeeded" },
      _sum: { amountCents: true },
    }),
  ]);
  const lifetimeFeesCents = feeAgg._sum.feeCents ?? 0;
  const paidCents = paidAgg._sum.amountCents ?? 0;
  const unpaidCents = computeUnpaidCents(lifetimeFeesCents, paidCents);
  return {
    lifetimeFeesCents,
    paidCents,
    unpaidCents,
    canPayCommission: canPayCommission(unpaidCents),
  };
}
```

- [ ] **Step 4: PASS + commit**

```powershell
npx vitest run tests/commission/balance.test.ts
```

```powershell
git add src/lib/commission/balance.ts tests/commission/balance.test.ts
git commit -m "feat: add commission unpaid balance helpers"
```

---

### Task 3: Commission Checkout POST (TDD)

**Files:**
- Create: `src/app/api/stores/[squareId]/commission/checkout/route.ts`
- Create: `tests/store/commissionCheckout.test.ts`

**Interfaces:**
- Consumes: `requireSquareStoreOwner`, `getStoreCommissionBalance`, `MIN_COMMISSION_CHECKOUT_CENTS`, `PENDING_CHECKOUT_GUARD_MS`, `getStripe`
- Produces: `POST` → `{ url: string }` or 401/403/404/400/409/502/503
- Creates Stripe session metadata: `type=commission`, `storeId`, `squareId`, `amountCents`, `payerId`
- Creates `CommissionPayment` with `status: "pending"`

- [ ] **Step 1: Failing tests** (mock auth, prisma, stripe)

Cases:
1. No session → 401  
2. Non-owner gate → 403  
3. No store on square → 404 `{ error: "Store not found" }`  
4. `unpaidCents === 49` → 400 `{ error: "Balance too small to pay yet" }`  
5. Recent pending payment → 409  
6. Happy path: Stripe `sessions.create` called with `unit_amount: unpaid`, pending row created, `{ url }` returned  

Stub pattern: mirror `tests/store/storeApi.test.ts` + mock `getStripe().checkout.sessions.create`.

- [ ] **Step 2: Implement route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getStoreCommissionBalance,
  MIN_COMMISSION_CHECKOUT_CENTS,
  PENDING_CHECKOUT_GUARD_MS,
} from "@/lib/commission/balance";
import { requireSquareStoreOwner } from "@/lib/store/assertSquareStoreOwner";
import { getStripe } from "@/lib/stripe";

type Params = { params: Promise<{ squareId: string }> };

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  console.warn(
    "NEXT_PUBLIC_APP_URL is unset; Stripe return URLs default to http://localhost:3000",
  );
  return "http://localhost:3000";
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  const { squareId } = await params;

  const gate = await requireSquareStoreOwner(squareId, session?.user?.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!gate.store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const storeId = gate.store.id;
  const payerId = session!.user!.id!;

  let balance;
  try {
    balance = await getStoreCommissionBalance(storeId);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  if (balance.unpaidCents < MIN_COMMISSION_CHECKOUT_CENTS) {
    return NextResponse.json(
      { error: "Balance too small to pay yet" },
      { status: 400 },
    );
  }

  const guardSince = new Date(Date.now() - PENDING_CHECKOUT_GUARD_MS);
  try {
    const recentPending = await prisma.commissionPayment.findFirst({
      where: {
        storeId,
        status: "pending",
        createdAt: { gte: guardSince },
      },
      select: { id: true },
    });
    if (recentPending) {
      return NextResponse.json(
        { error: "Checkout already in progress" },
        { status: 409 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  const amountCents = balance.unpaidCents;
  const base = appBaseUrl();

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: "Square Market commission" },
          },
        },
      ],
      metadata: {
        type: "commission",
        storeId,
        squareId,
        amountCents: String(amountCents),
        payerId,
      },
      success_url: `${base}/store/${squareId}/edit?commission=success`,
      cancel_url: `${base}/store/${squareId}/edit?commission=cancel`,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Checkout failed" }, { status: 502 });
    }

    await prisma.commissionPayment.create({
      data: {
        storeId,
        amountCents,
        stripeCheckoutSessionId: checkout.id,
        status: "pending",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    }
    console.error("Commission checkout session create failed", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: PASS + commit**

```powershell
npx vitest run tests/store/commissionCheckout.test.ts tests/commission/balance.test.ts
git add src/app/api/stores/[squareId]/commission/checkout/route.ts tests/store/commissionCheckout.test.ts
git commit -m "feat: add store commission Stripe Checkout endpoint"
```

---

### Task 4: Webhook commission handler (TDD)

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Create: `tests/commission/webhookCommission.test.ts` (keep primary tests untouched)

**Interfaces:**
- Consumes: `prisma.commissionPayment.findUnique` / `update`
- On `metadata.type === "commission"`: mark succeeded or refund on mismatch
- Primary path unchanged when `type === "primary"`

- [ ] **Step 1: Failing tests**

Mock `prisma.commissionPayment.findUnique` + `update`, Stripe constructEvent + refunds.create.

Cases:
1. paid + matching amount → `update` to `succeeded` + `succeededAt`  
2. already `succeeded` → no second update / no refund  
3. `amount_total !== amountCents` → no succeed + refund called  
4. `payment_status !== "paid"` → no update  
5. missing payment row → 200 received, no throw  

- [ ] **Step 2: Implement handler**

Add after primary branch in webhook:

```ts
async function refundCommissionIfPossible(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const pi = paymentIntentId(session.payment_intent);
  if (!pi) return;
  const existing = await prisma.commissionPayment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existing?.status === "succeeded") return;
  try {
    await stripe.refunds.create(
      { payment_intent: pi },
      { idempotencyKey: `commission-refund:${session.id}` },
    );
  } catch (error) {
    console.error("Stripe refund failed for commission checkout", {
      sessionId: session.id,
      paymentIntent: pi,
      error,
    });
  }
}

async function handleCommissionCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.payment_status !== "paid") {
    console.warn("Commission checkout ignored: payment not paid", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const payment = await prisma.commissionPayment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (!payment) {
    console.warn("Commission payment row missing", { sessionId: session.id });
    return;
  }
  if (payment.status === "succeeded") return;

  if (session.amount_total == null || session.amount_total !== payment.amountCents) {
    console.warn("Commission amount mismatch; refunding", {
      sessionId: session.id,
      amountTotal: session.amount_total,
      expected: payment.amountCents,
    });
    await refundCommissionIfPossible(stripe, session);
    return;
  }

  await prisma.commissionPayment.update({
    where: { id: payment.id },
    data: { status: "succeeded", succeededAt: new Date() },
  });
}
```

In `POST`:

```ts
if (event.type === "checkout.session.completed") {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.type === "primary") {
    await handlePrimaryCheckout(stripe, session);
  } else if (session.metadata?.type === "commission") {
    await handleCommissionCheckout(stripe, session);
  }
}
```

Extend `vi.mock("@/lib/db")` in the new test file with `commissionPayment: { findUnique, update }`.

- [ ] **Step 3: PASS + commit**

```powershell
npx vitest run tests/commission/webhookCommission.test.ts tests/ownership/webhookIdempotency.test.ts
git add src/app/api/stripe/webhook/route.ts tests/commission/webhookCommission.test.ts
git commit -m "feat: credit CommissionPayment on Stripe commission webhook"
```

---

### Task 5: Owner GET unpaid fields (TDD)

**Files:**
- Modify: `src/lib/store/serializeStore.ts`
- Modify: `src/app/api/stores/[squareId]/route.ts`
- Modify: `tests/store/storeApi.test.ts`

**Interfaces:**
- Consumes: `getStoreCommissionBalance(storeId)` for owner path
- Produces on store when owner metrics: `estimatedOwedCents` (= unpaid), `lifetimeFeesCents`, `paidCents`, `canPayCommission`
- Product `estimatedOwedCents` still = per-product fee sum (unchanged groupBy)

- [ ] **Step 1: Extend serialize types**

```ts
export type SerializedStore = {
  // ...existing...
  estimatedOwedCents?: number;
  lifetimeFeesCents?: number;
  paidCents?: number;
  canPayCommission?: boolean;
};

export function serializeStore(
  store: StoreRow,
  opts?: {
    estimatedOwedCents?: number;
    lifetimeFeesCents?: number;
    paidCents?: number;
    canPayCommission?: boolean;
  },
): SerializedStore {
  const serialized: SerializedStore = { /* existing fields */ };
  if (opts?.estimatedOwedCents !== undefined) {
    serialized.estimatedOwedCents = opts.estimatedOwedCents;
  }
  if (opts?.lifetimeFeesCents !== undefined) {
    serialized.lifetimeFeesCents = opts.lifetimeFeesCents;
  }
  if (opts?.paidCents !== undefined) {
    serialized.paidCents = opts.paidCents;
  }
  if (opts?.canPayCommission !== undefined) {
    serialized.canPayCommission = opts.canPayCommission;
  }
  return serialized;
}
```

Update `serializeStorePayload` opts to pass through the new store fields when `includeEstimatedOwed`.

- [ ] **Step 2: Update GET route**

Replace lifetime-only store sum with:

```ts
if (includeEstimatedOwed) {
  const [balance, byProduct] = await Promise.all([
    getStoreCommissionBalance(store.id),
    prisma.productClick.groupBy({
      by: ["productId"],
      where: { storeId: store.id },
      _sum: { feeCents: true },
    }),
  ]);
  // pass balance.unpaidCents as estimatedOwedCents, plus lifetime/paid/canPay
  // map product estimatedOwedCents from byProduct as today
}
```

- [ ] **Step 3: Update storeApi tests**

Mock `getStoreCommissionBalance` **or** mock `commissionPayment.aggregate` alongside existing click aggregates.

Owner assertions example:

```ts
expect(body.store.estimatedOwedCents).toBe(50); // unpaid
expect(body.store.lifetimeFeesCents).toBe(278);
expect(body.store.paidCents).toBe(228);
expect(body.store.canPayCommission).toBe(true);
```

Public: all money fields undefined; balance helpers / payment aggregate not required for public.

- [ ] **Step 4: PASS + commit**

```powershell
npx vitest run tests/store/storeApi.test.ts
git add src/lib/store/serializeStore.ts src/app/api/stores/[squareId]/route.ts tests/store/storeApi.test.ts
git commit -m "feat: expose unpaid commission balance on owner store API"
```

---

### Task 6: Store edit Pay UI

**Files:**
- Modify: `src/app/store/[squareId]/edit/store-edit-client.tsx`

**Interfaces:**
- Consumes: `estimatedOwedCents`, `lifetimeFeesCents`, `paidCents`, `canPayCommission` from `mine=1`
- Consumes: `?commission=success|cancel` via `useSearchParams` or `window.location` on load
- Produces: Pay button → `POST /api/stores/${squareId}/commission/checkout` → `window.location = url`

- [ ] **Step 1: State + load fields**

```ts
const [lifetimeFeesCents, setLifetimeFeesCents] = useState(0);
const [paidCents, setPaidCents] = useState(0);
const [canPayCommission, setCanPayCommission] = useState(false);
const [payBusy, setPayBusy] = useState(false);
const [commissionNote, setCommissionNote] = useState<string | null>(null);
```

On load from `body.store`, set all balance fields. On 404, reset to 0/false.

On mount, read `commission` query:

```ts
useEffect(() => {
  const sp = new URLSearchParams(window.location.search);
  const c = sp.get("commission");
  if (c === "success") {
    setCommissionNote(
      "Payment received — balance updates when Stripe confirms.",
    );
  } else if (c === "cancel") {
    setCommissionNote("Checkout canceled.");
  }
}, []);
```

- [ ] **Step 2: Render balance + Pay**

Replace the single owed line with:

```tsx
{hasStore ? (
  <div className="mb-4 space-y-2 text-sm text-zinc-600">
    {commissionNote ? (
      <p className="text-zinc-800">{commissionNote}</p>
    ) : null}
    <p>
      Estimated commission owed:{" "}
      <span className="font-medium text-zinc-900">
        {formatUsd(estimatedOwedCents)}
      </span>
    </p>
    <p className="text-xs text-zinc-500">
      Lifetime fees {formatUsd(lifetimeFeesCents)} · Paid{" "}
      {formatUsd(paidCents)}
    </p>
    {canPayCommission ? (
      <button
        type="button"
        disabled={payBusy}
        onClick={() => void payCommission()}
        className="min-h-11 rounded-lg bg-zinc-900 px-3 text-white"
      >
        {payBusy ? "Starting checkout…" : "Pay commission"}
      </button>
    ) : estimatedOwedCents > 0 ? (
      <p className="text-xs">Balance too small to pay yet</p>
    ) : null}
  </div>
) : null}
```

```ts
async function payCommission() {
  setPayBusy(true);
  setProductError(null);
  try {
    const res = await fetch(
      `/api/stores/${squareId}/commission/checkout`,
      { method: "POST" },
    );
    const body = (await res.json().catch(() => null)) as
      | { url?: string; error?: string }
      | null;
    if (!res.ok || !body?.url) {
      throw new Error(body?.error ?? "Checkout failed");
    }
    window.location.href = body.url;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Checkout failed");
    setPayBusy(false);
  }
}
```

- [ ] **Step 3: Full suite + commit**

```powershell
npx vitest run
```

Expected: all green (prior ~127+ new tests).

```powershell
git add src/app/store/[squareId]/edit/store-edit-client.tsx
git commit -m "feat: add Pay commission button on store edit"
```

- [ ] **Step 4: Manual smoke (Stripe test mode)**

1. Ensure unpaid ≥ 50¢ (trigger `/go` clicks if needed).  
2. Owner edit → Pay commission → test card `4242…`.  
3. Webhook (Stripe CLI or dashboard) → unpaid drops by paid amount.  
4. Confirm second Pay while pending &lt;1h → 409.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `CommissionPayment` model | 1 |
| Unpaid = fees − succeeded payments; min 50 | 2 |
| Checkout POST freeze + pending + URLs | 3 |
| Pending 1h guard | 3 |
| Webhook succeed / idempotent / mismatch refund | 4 |
| Owner unpaid + lifetime + paid + canPay | 5 |
| Product fee sum unchanged | 5 |
| Edit Pay UI + query notes | 6 |

---

## Self-review notes

- No TBD steps; signatures consistent (`getStoreCommissionBalance`, `MIN_COMMISSION_CHECKOUT_CENTS=50`).
- Primary webhook path preserved; commission refunds use separate idempotency keys.
- `estimatedOwedCents` store semantic shift to unpaid is explicit in Task 5 tests.
